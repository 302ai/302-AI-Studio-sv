/**
 * Plugin Service
 *
 * IPC service for managing plugins from the renderer process
 */

import type { InstalledPlugin, ProviderDefinition } from "@302ai/studio-plugin-sdk";
import type { Model, ModelProvider, PluginSource } from "@shared/types";
import { app, dialog, type IpcMainInvokeEvent } from "electron";
import fs from "fs-extra";
import extract from "extract-zip";
import ky from "ky";
import os from "os";
import path from "path";
import { pluginLoader } from "../plugin-manager/plugin-loader";
import { pluginRegistry } from "../plugin-manager/plugin-registry";
import {
	executeFetchModelsHook,
	hasProviderPlugin,
} from "../plugin-manager/provider-plugin-helper";
import { storageService } from "./storage-service";
import { registryService } from "./registry-service";

/**
 * Plugin Service Class
 * Provides IPC methods for plugin management
 */
export class PluginService {
	/**
	 * Get all installed plugins
	 */
	async getInstalledPlugins(_event: IpcMainInvokeEvent): Promise<InstalledPlugin[]> {
		return pluginLoader.getLoadedPlugins();
	}

	/**
	 * Get a specific plugin by ID
	 */
	async getPlugin(_event: IpcMainInvokeEvent, pluginId: string): Promise<InstalledPlugin | null> {
		return pluginLoader.getPlugin(pluginId);
	}

	/**
	 * Get enabled plugins
	 */
	async getEnabledPlugins(_event: IpcMainInvokeEvent): Promise<InstalledPlugin[]> {
		const registered = pluginRegistry.getEnabled();
		return registered.map((p) => p.plugin);
	}

	/**
	 * Get provider plugins (enabled provider plugins only)
	 */
	async getProviderPlugins(_event: IpcMainInvokeEvent): Promise<ProviderDefinition[]> {
		const registered = pluginRegistry.getEnabled();
		const providerPlugins = registered.filter((p) => p.plugin.metadata.type === "provider");

		const definitions: ProviderDefinition[] = [];

		for (const { instance } of providerPlugins) {
			try {
				const definition = await instance.getProviderDefinition();
				definitions.push(definition);
			} catch (error) {
				console.error("Failed to get provider definition:", error);
			}
		}

		return definitions;
	}

	/**
	 * Enable a plugin
	 */
	async enablePlugin(_event: IpcMainInvokeEvent, pluginId: string): Promise<void> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		if (plugin.status === "enabled") {
			return; // Already enabled
		}

		// Reload the plugin to enable it
		await pluginLoader.reloadPlugin(pluginId);
		plugin.status = "enabled";

		console.log(`[PluginService] Enabled plugin: ${pluginId}`);
	}

	/**
	 * Disable a plugin
	 */
	async disablePlugin(_event: IpcMainInvokeEvent, pluginId: string): Promise<void> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		if (plugin.metadata.builtin) {
			throw new Error(`Cannot disable builtin plugin: ${pluginId}`);
		}

		if (plugin.status === "disabled") {
			return; // Already disabled
		}

		// Unload the plugin
		await pluginLoader.unloadPlugin(pluginId);
		plugin.status = "disabled";

		console.log(`[PluginService] Disabled plugin: ${pluginId}`);
	}

	/**
	 * Download a plugin from a URL
	 * @param url The URL to download from
	 * @returns The path to the downloaded and extracted plugin
	 */
	private async downloadPluginFromUrl(url: string): Promise<string> {
		console.log(`[PluginService] Downloading plugin from: ${url}`);

		// Create a temporary directory for download
		const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "plugin-download-"));
		const zipPath = path.join(tempDir, "plugin.zip");

		try {
			// Download the plugin
			const response = await ky.get(url, {
				timeout: 120000, // 2 minutes timeout
				headers: {
					"User-Agent": "302-AI-Studio-Plugin-Installer",
				},
			});

			if (!response.ok) {
				throw new Error(`Failed to download plugin: ${response.status} ${response.statusText}`);
			}

			// Get the array buffer and save to file
			const arrayBuffer = await response.arrayBuffer();
			await fs.writeFile(zipPath, Buffer.from(arrayBuffer));

			console.log(`[PluginService] Downloaded plugin to: ${zipPath}`);

			// Extract the zip file
			const extractDir = path.join(tempDir, "extracted");
			await fs.ensureDir(extractDir);

			await extract(zipPath, {
				dir: extractDir,
			});

			console.log(`[PluginService] Extracted plugin to: ${extractDir}`);

			// Move to final location
			const pluginsDir = path.join(app.getPath("userData"), "plugins", "external");
			await fs.ensureDir(pluginsDir);

			const pluginId = `external-${Date.now()}`;
			const finalDir = path.join(pluginsDir, pluginId);

			await fs.move(extractDir, finalDir);

			// Clean up temp zip file
			await fs.remove(zipPath);

			console.log(`[PluginService] Plugin installed to: ${finalDir}`);

			return finalDir;
		} catch (err) {
			// Clean up on error
			await fs.remove(tempDir);
			throw err;
		}
	}

	/**
	 * Install a plugin from a source
	 */
	async installPlugin(_event: IpcMainInvokeEvent, source: PluginSource): Promise<InstalledPlugin> {
		console.log(`[PluginService] Installing plugin from source:`, source);

		let pluginPath: string;

		switch (source.type) {
			case "local":
				pluginPath = source.path;
				break;

			case "url":
				if (!source.url) {
					throw new Error("URL source requires a URL");
				}
				pluginPath = await this.downloadPluginFromUrl(source.url);
				break;

			case "marketplace": {
				if (!source.id) {
					throw new Error("Marketplace source requires a plugin ID");
				}

				// Get plugin info from registry
				const marketplacePlugin = await registryService.getMarketplacePlugin(_event, source.id);
				if (!marketplacePlugin) {
					throw new Error(`Plugin ${source.id} not found in marketplace`);
				}

				// Download from the registry's download URL
				console.log(
					`[PluginService] Installing ${marketplacePlugin.metadata.name} from marketplace`,
				);
				pluginPath = await this.downloadPluginFromUrl(marketplacePlugin.downloadUrl);
				break;
			}

			default:
				throw new Error(`Unknown plugin source type: ${(source as { type: string }).type}`);
		}

		// Load the plugin
		const plugin = await pluginLoader.loadPlugin(pluginPath);

		console.log(`[PluginService] Installed plugin: ${plugin.metadata.id}`);
		return plugin;
	}

	/**
	 * Uninstall a plugin
	 */
	async uninstallPlugin(_event: IpcMainInvokeEvent, pluginId: string): Promise<void> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		if (plugin.metadata.builtin) {
			throw new Error(`Cannot uninstall builtin plugin: ${pluginId}`);
		}

		const pluginPath = plugin.path;

		// Unload the plugin first
		await pluginLoader.unloadPlugin(pluginId);

		// Delete plugin files
		try {
			await fs.remove(pluginPath);
			console.log(`[PluginService] Deleted plugin files at: ${pluginPath}`);
		} catch (err) {
			console.error(`[PluginService] Failed to delete plugin files:`, err);
			throw new Error(
				`Failed to delete plugin files: ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		// Clean up plugin configuration from storage
		const configPrefix = `plugin:${pluginId}:config:`;
		const allKeys = await storageService.getKeys(_event);
		const configKeys = allKeys.filter((key: string) => key.startsWith(configPrefix));

		for (const key of configKeys) {
			await storageService.removeItem(_event, key);
		}

		console.log(`[PluginService] Uninstalled plugin: ${pluginId}`);
	}

	/**
	 * Check for plugin updates
	 * @param pluginId The plugin ID to check
	 * @returns Object with update information
	 */
	async checkForUpdates(
		_event: IpcMainInvokeEvent,
		pluginId: string,
	): Promise<{
		hasUpdate: boolean;
		currentVersion: string;
		latestVersion?: string;
		downloadUrl?: string;
	}> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		const currentVersion = plugin.metadata.version;

		// For external plugins, try to check from the plugin path
		if (plugin.metadata.builtin) {
			// Built-in plugins don't need updates
			return {
				hasUpdate: false,
				currentVersion,
			};
		}

		// Try to find an update URL in the plugin metadata or plugin.json
		try {
			const pluginJsonPath = path.join(plugin.path, "plugin.json");
			if (await fs.pathExists(pluginJsonPath)) {
				// TODO: Read plugin.json to check for repository or update URL
				// const pluginJson = await fs.readJson(pluginJsonPath);

				// If the plugin has a repository or update URL, we could check it here
				// For now, we'll just indicate no update is available

				return {
					hasUpdate: false,
					currentVersion,
				};
			}
		} catch (err) {
			console.warn(`[PluginService] Failed to check updates for ${pluginId}:`, err);
		}

		return {
			hasUpdate: false,
			currentVersion,
		};
	}

	/**
	 * Update a plugin
	 */
	async updatePlugin(_event: IpcMainInvokeEvent, pluginId: string): Promise<void> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		if (plugin.metadata.builtin) {
			throw new Error(`Cannot update builtin plugin: ${pluginId}`);
		}

		// For external plugins installed from URL, we could implement update logic here
		// For now, just reload the plugin

		await pluginLoader.reloadPlugin(pluginId);

		console.log(`[PluginService] Updated plugin: ${pluginId}`);
	}

	/**
	 * Reload a plugin
	 */
	async reloadPlugin(_event: IpcMainInvokeEvent, pluginId: string): Promise<void> {
		await pluginLoader.reloadPlugin(pluginId);
		console.log(`[PluginService] Reloaded plugin: ${pluginId}`);
	}

	/**
	 * Show a dialog to select a plugin folder
	 * @returns The selected folder path, or null if cancelled
	 */
	async selectPluginFolder(_event: IpcMainInvokeEvent): Promise<string | null> {
		const { canceled, filePaths } = await dialog.showOpenDialog({
			title: "Select Plugin Folder",
			properties: ["openDirectory"],
		});

		if (canceled || filePaths.length === 0) {
			return null;
		}

		return filePaths[0];
	}

	/**
	 * Get plugin configuration
	 */
	async getPluginConfig(
		_event: IpcMainInvokeEvent,
		pluginId: string,
	): Promise<Record<string, unknown>> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		return plugin.config;
	}

	/**
	 * Set plugin configuration
	 */
	async setPluginConfig(
		_event: IpcMainInvokeEvent,
		pluginId: string,
		config: Record<string, unknown>,
	): Promise<void> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		// Update in-memory config
		plugin.config = { ...plugin.config, ...config };

		// Persist each config key to storage
		const configPrefix = `plugin:${pluginId}:config:`;
		for (const [key, value] of Object.entries(config)) {
			await storageService.setItem(_event, configPrefix + key, value as never);
		}

		console.log(`[PluginService] Updated and persisted config for plugin: ${pluginId}`);
	}

	/**
	 * Get plugin configuration value
	 */
	async getPluginConfigValue(
		_event: IpcMainInvokeEvent,
		pluginId: string,
		key: string,
	): Promise<unknown> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		return plugin.config[key];
	}

	/**
	 * Set plugin configuration value
	 */
	async setPluginConfigValue(
		_event: IpcMainInvokeEvent,
		pluginId: string,
		key: string,
		value: unknown,
	): Promise<void> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		// Update in-memory config
		plugin.config[key] = value;

		// Persist to storage
		const configPrefix = `plugin:${pluginId}:config:`;
		await storageService.setItem(_event, configPrefix + key, value as never);

		console.log(
			`[PluginService] Updated and persisted config value for plugin: ${pluginId}, key: ${key}`,
		);
	}

	/**
	 * Initialize plugin system
	 * Called when the application starts
	 */
	async initialize(): Promise<void> {
		console.log("[PluginService] Initializing plugin system...");

		try {
			await pluginLoader.loadAllPlugins();
			console.log(
				`[PluginService] Plugin system initialized with ${pluginLoader.getLoadedPlugins().length} plugins`,
			);
		} catch (error) {
			console.error("[PluginService] Failed to initialize plugin system:", error);
			throw error;
		}
	}

	/**
	 * Fetch models from a provider using its plugin
	 */
	async fetchModelsFromProvider(
		_event: IpcMainInvokeEvent,
		provider: ModelProvider,
	): Promise<Model[]> {
		console.log(`[PluginService] Fetching models for provider: ${provider.id}`);

		try {
			// Check if provider has a registered plugin
			if (!hasProviderPlugin(provider.id)) {
				console.warn(`[PluginService] No plugin registered for provider ${provider.id}`);
				return [];
			}

			// Execute fetch models hook through plugin
			const models = await executeFetchModelsHook(provider);

			console.log(`[PluginService] Fetched ${models.length} models for provider: ${provider.id}`);

			// Convert Set to Array for IPC serialization
			const serializedModels = models.map((model) => ({
				...model,
				capabilities: Array.from(model.capabilities),
			}));

			return serializedModels as unknown as Model[];
		} catch (error) {
			console.error(`[PluginService] Error fetching models for provider ${provider.id}:`, error);
			throw error;
		}
	}

	/**
	 * Execute before send message hook
	 */
	async executeBeforeSendMessageHook(
		_event: IpcMainInvokeEvent,
		context: {
			messages: unknown[];
			userMessage: unknown;
			model: Model;
			provider: ModelProvider;
			parameters: Record<string, unknown>;
			options: Record<string, unknown>;
		},
	): Promise<{
		messages: unknown[];
		userMessage: unknown;
		model: Model;
		provider: ModelProvider;
		parameters: Record<string, unknown>;
		options: Record<string, unknown>;
	}> {
		console.log("[PluginService] Executing before send message hook");

		try {
			const { executeBeforeSendMessageHook } = await import(
				"../plugin-manager/provider-plugin-helper"
			);
			const result = await executeBeforeSendMessageHook(context);
			return result;
		} catch (error) {
			console.error("[PluginService] Before send message hook failed:", error);
			// Return original context on error
			return context;
		}
	}

	/**
	 * Execute after send message hook
	 */
	async executeAfterSendMessageHook(
		_event: IpcMainInvokeEvent,
		context: {
			messages: unknown[];
			userMessage: unknown;
			model: Model;
			provider: ModelProvider;
			parameters: Record<string, unknown>;
			options: Record<string, unknown>;
		},
		response: {
			message: unknown;
			usage?: {
				promptTokens: number;
				completionTokens: number;
				totalTokens: number;
			};
			model: string;
			finishReason: string;
			metadata?: Record<string, unknown>;
		},
	): Promise<void> {
		console.log("[PluginService] Executing after send message hook");

		try {
			const { executeAfterSendMessageHook } = await import(
				"../plugin-manager/provider-plugin-helper"
			);
			await executeAfterSendMessageHook(context, response);
		} catch (error) {
			console.error("[PluginService] After send message hook failed:", error);
			// Continue execution even if hook fails
		}
	}

	/**
	 * Execute error hook
	 */
	async executeErrorHook(
		_event: IpcMainInvokeEvent,
		errorData: { message: string; stack?: string; name?: string },
		context: {
			source: string;
			provider?: ModelProvider;
			model?: Model;
			metadata?: Record<string, unknown>;
		},
	): Promise<{
		handled: boolean;
		retry?: boolean;
		retryDelay?: number;
		message?: string;
	}> {
		console.log("[PluginService] Executing error hook");

		try {
			const { executeErrorHook } = await import("../plugin-manager/provider-plugin-helper");
			// Reconstruct Error object
			const error = new Error(errorData.message);
			error.stack = errorData.stack;
			error.name = errorData.name || "Error";
			const result = await executeErrorHook(error, context);
			return result;
		} catch (hookError) {
			console.error("[PluginService] Error hook failed:", hookError);
			// Return not handled on error
			return { handled: false };
		}
	}
}

// Singleton instance
export const pluginService = new PluginService();
