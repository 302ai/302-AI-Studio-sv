/**
 * Plugin Manager
 *
 * Main entry point for the plugin system
 * Exports all plugin-related modules and provides initialization
 */

export * from "./plugin-api";
export * from "./plugin-loader";
export * from "./plugin-registry";
export * from "./hook-manager";
export * from "./sandbox";

import { pluginLoader } from "./plugin-loader";
import { pluginRegistry } from "./plugin-registry";
import { hookManager } from "./hook-manager";

/**
 * Initialize the plugin system
 */
export async function initializePluginSystem(): Promise<void> {
	console.log("[PluginManager] Initializing plugin system...");

	try {
		// Load all plugins
		await pluginLoader.loadAllPlugins();

		const loadedCount = pluginLoader.getLoadedPlugins().length;
		const enabledCount = pluginRegistry.getEnabled().length;

		console.log(
			`[PluginManager] Plugin system initialized successfully. ` +
				`Loaded: ${loadedCount}, Enabled: ${enabledCount}`,
		);
	} catch (error) {
		console.error("[PluginManager] Failed to initialize plugin system:", error);
		throw error;
	}
}

/**
 * Shutdown the plugin system
 */
export async function shutdownPluginSystem(): Promise<void> {
	console.log("[PluginManager] Shutting down plugin system...");

	try {
		// Unload all plugins
		const plugins = pluginLoader.getLoadedPlugins();
		for (const plugin of plugins) {
			if (!plugin.metadata.builtin) {
				await pluginLoader.unloadPlugin(plugin.metadata.id);
			}
		}

		// Clear registries
		hookManager.clear();

		console.log("[PluginManager] Plugin system shutdown complete");
	} catch (error) {
		console.error("[PluginManager] Error during plugin system shutdown:", error);
	}
}

/**
 * Get plugin manager instances
 */
export function getPluginManagerInstances() {
	return {
		pluginLoader,
		pluginRegistry,
		hookManager,
	};
}
