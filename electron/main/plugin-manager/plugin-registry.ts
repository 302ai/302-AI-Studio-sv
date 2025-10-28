/**
 * Plugin Registry
 *
 * Manages registered plugin instances and their metadata
 */

import type { InstalledPlugin, ProviderPlugin } from "@302ai/studio-plugin-sdk";
import type { IPluginRegistry } from "./types";

interface RegisteredPlugin {
	plugin: InstalledPlugin;
	instance: ProviderPlugin;
}

/**
 * Plugin registry implementation
 * Maintains a map of plugin ID to plugin instance and metadata
 */
export class PluginRegistry implements IPluginRegistry {
	private plugins: Map<string, RegisteredPlugin> = new Map();

	/**
	 * Register a plugin
	 */
	register(plugin: InstalledPlugin, instance: ProviderPlugin): void {
		if (this.plugins.has(plugin.metadata.id)) {
			throw new Error(`Plugin ${plugin.metadata.id} is already registered`);
		}

		this.plugins.set(plugin.metadata.id, { plugin, instance });
		console.log(`[PluginRegistry] Registered plugin: ${plugin.metadata.id}`);
	}

	/**
	 * Unregister a plugin
	 */
	unregister(pluginId: string): void {
		if (!this.plugins.has(pluginId)) {
			console.warn(`[PluginRegistry] Plugin ${pluginId} is not registered`);
			return;
		}

		this.plugins.delete(pluginId);
		console.log(`[PluginRegistry] Unregistered plugin: ${pluginId}`);
	}

	/**
	 * Get registered plugin
	 */
	get(pluginId: string): RegisteredPlugin | null {
		return this.plugins.get(pluginId) || null;
	}

	/**
	 * Get all registered plugins
	 */
	getAll(): Map<string, RegisteredPlugin> {
		return new Map(this.plugins);
	}

	/**
	 * Check if plugin is registered
	 */
	has(pluginId: string): boolean {
		return this.plugins.has(pluginId);
	}

	/**
	 * Get registered plugin count
	 */
	count(): number {
		return this.plugins.size;
	}

	/**
	 * Get plugins by type
	 */
	getByType(type: string): RegisteredPlugin[] {
		return Array.from(this.plugins.values()).filter((p) => p.plugin.metadata.type === type);
	}

	/**
	 * Get enabled plugins
	 */
	getEnabled(): RegisteredPlugin[] {
		return Array.from(this.plugins.values()).filter((p) => p.plugin.status === "enabled");
	}

	/**
	 * Clear all plugins
	 */
	clear(): void {
		this.plugins.clear();
		console.log("[PluginRegistry] Cleared all plugins");
	}
}

// Singleton instance
export const pluginRegistry = new PluginRegistry();
