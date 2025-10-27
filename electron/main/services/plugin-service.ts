/**
 * Plugin Service
 *
 * IPC service for managing plugins from the renderer process
 */

import type { InstalledPlugin, PluginSource, ProviderDefinition } from "$lib/plugin-system/types";
import type { Model, ModelProvider } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { pluginLoader } from "../plugin-manager/plugin-loader";
import { pluginRegistry } from "../plugin-manager/plugin-registry";
import {
	executeFetchModelsHook,
	hasProviderPlugin,
} from "../plugin-manager/provider-plugin-helper";

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
				// TODO: Download plugin from URL
				throw new Error("URL-based plugin installation not yet implemented");

			case "marketplace":
				// TODO: Download plugin from marketplace
				throw new Error("Marketplace-based plugin installation not yet implemented");

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

		// Unload the plugin
		await pluginLoader.unloadPlugin(pluginId);

		// TODO: Delete plugin files
		// For now, just unload it
		console.log(`[PluginService] Uninstalled plugin: ${pluginId}`);
	}

	/**
	 * Update a plugin
	 */
	async updatePlugin(_event: IpcMainInvokeEvent, pluginId: string): Promise<void> {
		const plugin = pluginLoader.getPlugin(pluginId);
		if (!plugin) {
			throw new Error(`Plugin ${pluginId} not found`);
		}

		// TODO: Check for updates and download
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

		plugin.config = { ...plugin.config, ...config };

		// TODO: Persist config to storage
		console.log(`[PluginService] Updated config for plugin: ${pluginId}`);
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

		plugin.config[key] = value;

		// TODO: Persist config to storage
		console.log(`[PluginService] Updated config value for plugin: ${pluginId}, key: ${key}`);
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
}

// Singleton instance
export const pluginService = new PluginService();
