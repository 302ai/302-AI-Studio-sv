/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Plugin Loader
 *
 * Loads and initializes plugins from file system
 */

import type { InstalledPlugin, PluginMetadata, ProviderPlugin } from "$lib/plugin-system/types";
import { app } from "electron";
import * as fs from "fs";
import * as path from "path";
import { storageService } from "../services/storage-service";
import { hookManager } from "./hook-manager";
import { createPluginAPI } from "./plugin-api";
import { pluginRegistry } from "./plugin-registry";

// Import built-in plugins statically for development
import { AI302ProviderPlugin } from "../../../plugins/builtin/302ai-plugin/main/index";
import { AnthropicProviderPlugin } from "../../../plugins/builtin/anthropic-plugin/main/index";
import { DebugProviderPlugin } from "../../../plugins/builtin/debug-plugin/main/index";
import { GoogleProviderPlugin } from "../../../plugins/builtin/google-plugin/main/index";
import { OpenAIProviderPlugin } from "../../../plugins/builtin/openai-plugin/main/index";

// Map of built-in plugin IDs to their class constructors
const BUILTIN_PLUGINS: Record<string, new () => ProviderPlugin> = {
	"com.302ai.provider.openai": OpenAIProviderPlugin,
	"com.302ai.provider.anthropic": AnthropicProviderPlugin,
	"com.302ai.provider.google": GoogleProviderPlugin,
	"com.302ai.provider.302ai": AI302ProviderPlugin,
	"com.302ai.provider.debug": DebugProviderPlugin,
};

/**
 * Plugin loader implementation
 * Scans directories and loads plugin modules
 */
export class PluginLoader {
	private pluginDirs: string[];
	private loadedPlugins: Map<string, InstalledPlugin> = new Map();

	constructor(pluginDirs?: string[]) {
		// Default plugin directories
		this.pluginDirs = pluginDirs || [
			// Builtin plugins
			path.join(app.getAppPath(), "plugins", "builtin"),
			// User plugins
			path.join(app.getPath("userData"), "plugins"),
		];

		// Ensure plugin directories exist
		this.ensurePluginDirs();
	}

	/**
	 * Ensure plugin directories exist
	 */
	private ensurePluginDirs(): void {
		for (const dir of this.pluginDirs) {
			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
				console.log(`[PluginLoader] Created plugin directory: ${dir}`);
			}
		}
	}

	/**
	 * Load all plugins from configured directories
	 */
	async loadAllPlugins(): Promise<void> {
		console.log("[PluginLoader] Loading plugins from directories:", this.pluginDirs);

		for (const dir of this.pluginDirs) {
			await this.loadPluginsFromDirectory(dir);
		}

		console.log(`[PluginLoader] Loaded ${this.loadedPlugins.size} plugins`);
	}

	/**
	 * Load plugins from a directory
	 */
	private async loadPluginsFromDirectory(dir: string): Promise<void> {
		if (!fs.existsSync(dir)) {
			console.warn(`[PluginLoader] Directory does not exist: ${dir}`);
			return;
		}

		const entries = fs.readdirSync(dir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const pluginPath = path.join(dir, entry.name);

			try {
				await this.loadPlugin(pluginPath);
			} catch (error) {
				console.error(`[PluginLoader] Failed to load plugin from ${pluginPath}:`, error);
			}
		}
	}

	/**
	 * Load a single plugin
	 */
	async loadPlugin(pluginPath: string): Promise<InstalledPlugin> {
		console.log(`[PluginLoader] Loading plugin from: ${pluginPath}`);

		// Load and validate metadata
		const metadata = await this.loadMetadata(pluginPath);

		// Check if already loaded
		if (this.loadedPlugins.has(metadata.id)) {
			throw new Error(`Plugin ${metadata.id} is already loaded`);
		}

		// Validate compatibility
		this.validateCompatibility(metadata);

		// Create plugin entry with default config
		const plugin: InstalledPlugin = {
			metadata,
			path: pluginPath,
			status: "installed",
			installedAt: new Date(),
			config: metadata.defaultConfig || {},
		};

		// Load saved configuration from storage
		try {
			const configPrefix = `plugin:${metadata.id}:config:`;
			const configKeys = await storageService.getKeys(
				{ sender: { id: -1 } } as never,
				configPrefix,
			);

			// Load each config value
			for (const fullKey of configKeys) {
				// Remove .json suffix and prefix to get the actual config key
				// fullKey: "plugin:com.302ai.provider.debug:config:enabled.json"
				// configKey: "enabled"
				const configKey = fullKey
					.replace(configPrefix, "") // "enabled.json"
					.replace(/\.json$/, ""); // "enabled"

				const value = await storageService.getItem({ sender: { id: -1 } } as never, fullKey);
				if (value !== null) {
					plugin.config[configKey] = value;
				}
			}

			if (configKeys.length > 0) {
				console.log(
					`[PluginLoader] Loaded ${configKeys.length} config values for ${metadata.id}:`,
					plugin.config,
				);
			}
		} catch (error) {
			console.warn(`[PluginLoader] Failed to load saved config for ${metadata.id}:`, error);
			// Continue with default config
		}

		// Load plugin module
		let pluginInstance: ProviderPlugin;
		try {
			pluginInstance = await this.loadPluginModule(plugin);
		} catch (error) {
			plugin.status = "error";
			plugin.error = error instanceof Error ? error.message : String(error);
			this.loadedPlugins.set(metadata.id, plugin);
			throw error;
		}

		// Create plugin API
		const pluginAPI = createPluginAPI(plugin, hookManager);

		// Initialize plugin
		try {
			if (pluginInstance.initialize) {
				await pluginInstance.initialize(pluginAPI);
			}

			// Inject API into plugin instance
			pluginInstance.api = pluginAPI;

			// Register with plugin registry
			pluginRegistry.register(plugin, pluginInstance);

			// Register hooks
			await this.registerPluginHooks(plugin, pluginInstance);

			// Mark as enabled
			plugin.status = "enabled";
			this.loadedPlugins.set(metadata.id, plugin);

			console.log(`[PluginLoader] Successfully loaded plugin: ${metadata.id}`);
		} catch (error) {
			plugin.status = "error";
			plugin.error = error instanceof Error ? error.message : String(error);
			this.loadedPlugins.set(metadata.id, plugin);
			throw error;
		}

		return plugin;
	}

	/**
	 * Load plugin metadata from plugin.json
	 */
	private async loadMetadata(pluginPath: string): Promise<PluginMetadata> {
		const metadataPath = path.join(pluginPath, "plugin.json");

		if (!fs.existsSync(metadataPath)) {
			throw new Error(`plugin.json not found in ${pluginPath}`);
		}

		const content = fs.readFileSync(metadataPath, "utf-8");
		const metadata: PluginMetadata = JSON.parse(content);

		// Validate required fields
		const requiredFields = ["id", "name", "version", "type", "description", "author"];
		for (const field of requiredFields) {
			if (!metadata[field as keyof PluginMetadata]) {
				throw new Error(`Missing required field in plugin.json: ${field}`);
			}
		}

		return metadata;
	}

	/**
	 * Validate plugin compatibility with current application version
	 */
	private validateCompatibility(metadata: PluginMetadata): void {
		// For now, just log a warning if compatibility info is missing
		if (!metadata.compatibleVersion) {
			console.warn(`[PluginLoader] Plugin ${metadata.id} does not specify compatible version`);
		}

		// TODO: Implement semver range checking
		// const appVersion = app.getVersion();
		// if (!semver.satisfies(appVersion, metadata.compatibleVersion)) {
		//   throw new Error(`Plugin ${metadata.id} is not compatible with app version ${appVersion}`);
		// }
	}

	/**
	 * Load plugin module
	 */
	private async loadPluginModule(plugin: InstalledPlugin): Promise<ProviderPlugin> {
		// For built-in plugins, use static imports
		if (plugin.metadata.builtin && BUILTIN_PLUGINS[plugin.metadata.id]) {
			const PluginClass = BUILTIN_PLUGINS[plugin.metadata.id];
			return new PluginClass();
		}

		// For external plugins, use dynamic imports
		const mainPath = plugin.metadata.main || "main/index.js";
		let modulePath = path.join(plugin.path, mainPath);

		// In development, check for .ts file if .js doesn't exist
		if (!fs.existsSync(modulePath)) {
			// Try .ts extension for development
			const tsPath = modulePath.replace(/\.js$/, ".ts");
			if (fs.existsSync(tsPath)) {
				modulePath = tsPath;
			} else {
				throw new Error(`Plugin main file not found: ${modulePath}`);
			}
		}

		// Dynamic import of plugin module
		// In production, this would need to handle require() for CommonJS modules
		let pluginModule: { default?: ProviderPlugin; [key: string]: unknown };

		try {
			// For TypeScript/ESM
			if (modulePath.endsWith(".ts") || modulePath.endsWith(".mjs")) {
				// In development with ts-node or similar, this will work
				// Note: This requires the TypeScript file to be importable
				pluginModule = await import(modulePath);
			} else {
				// For CommonJS - dynamic require

				pluginModule = { default: require(modulePath) };
			}
		} catch (error) {
			console.error(`[PluginLoader] Failed to import plugin module:`, error);
			throw new Error(`Failed to load plugin module: ${error}`);
		}

		// Get plugin instance
		let instance: ProviderPlugin;

		if (pluginModule.default) {
			// If default export is a class, instantiate it
			if (typeof pluginModule.default === "function") {
				instance = new (pluginModule.default as new () => ProviderPlugin)();
			} else {
				instance = pluginModule.default;
			}
		} else if (pluginModule.plugin) {
			instance = pluginModule.plugin as ProviderPlugin;
		} else {
			throw new Error("Plugin module must export a default or named 'plugin' export");
		}

		// Validate plugin instance
		this.validatePluginInstance(instance);

		return instance;
	}

	/**
	 * Validate plugin instance has required methods
	 */
	private validatePluginInstance(instance: ProviderPlugin): void {
		const requiredMethods = ["getProviderDefinition", "onAuthenticate", "onFetchModels"];

		for (const method of requiredMethods) {
			if (typeof instance[method as keyof ProviderPlugin] !== "function") {
				throw new Error(`Plugin instance missing required method: ${method}`);
			}
		}
	}

	/**
	 * Register plugin hooks
	 */
	private async registerPluginHooks(
		plugin: InstalledPlugin,
		instance: ProviderPlugin,
	): Promise<void> {
		const pluginId = plugin.metadata.id;

		// Register all optional hooks
		const hookMethods: Array<[string, keyof ProviderPlugin]> = [
			["provider:before-send-message", "onBeforeSendMessage"],
			["provider:send-message", "onSendMessage"],
			["provider:after-send-message", "onAfterSendMessage"],
			["provider:stream-chunk", "onStreamChunk"],
			["provider:error", "onError"],
		];

		for (const [hookName, methodName] of hookMethods) {
			const method = instance[methodName];
			if (typeof method === "function") {
				hookManager.register(hookName, pluginId, method.bind(instance) as () => unknown);
			}
		}

		console.log(`[PluginLoader] Registered hooks for plugin: ${pluginId}`);
	}

	/**
	 * Unload a plugin
	 */
	async unloadPlugin(pluginId: string): Promise<void> {
		const plugin = this.loadedPlugins.get(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} is not loaded`);
		}

		// Check if plugin is builtin (cannot be unloaded)
		if (plugin.metadata.builtin) {
			throw new Error(`Cannot unload builtin plugin: ${pluginId}`);
		}

		// Get plugin instance
		const registered = pluginRegistry.get(pluginId);
		if (registered) {
			// Cleanup plugin
			if (registered.instance.cleanup) {
				await registered.instance.cleanup();
			}

			// Unregister from registry
			pluginRegistry.unregister(pluginId);
		}

		// Clear hooks
		hookManager.clearPlugin(pluginId);

		// Remove from loaded plugins
		this.loadedPlugins.delete(pluginId);

		console.log(`[PluginLoader] Unloaded plugin: ${pluginId}`);
	}

	/**
	 * Reload a plugin
	 */
	async reloadPlugin(pluginId: string): Promise<void> {
		const plugin = this.loadedPlugins.get(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} is not loaded`);
		}

		const pluginPath = plugin.path;

		// Unload current plugin
		await this.unloadPlugin(pluginId);

		// Load plugin again
		await this.loadPlugin(pluginPath);

		console.log(`[PluginLoader] Reloaded plugin: ${pluginId}`);
	}

	/**
	 * Get all loaded plugins
	 */
	getLoadedPlugins(): InstalledPlugin[] {
		return Array.from(this.loadedPlugins.values());
	}

	/**
	 * Get a specific loaded plugin
	 */
	getPlugin(pluginId: string): InstalledPlugin | null {
		return this.loadedPlugins.get(pluginId) || null;
	}
}

// Singleton instance
export const pluginLoader = new PluginLoader();
