/**
 * Plugin State Management
 *
 * Manages plugin state in the renderer process
 */

import type { InstalledPlugin, PluginSource, ProviderDefinition } from "@shared/types";
import type { Model, ModelProvider } from "@shared/types";

const { pluginService } = window.electronAPI;

/**
 * Plugin State Class
 * Manages installed plugins and provider plugins
 */
class PluginState {
	/** Installed plugins */
	installedPlugins = $state<InstalledPlugin[]>([]);

	/** Enabled plugins */
	enabledPlugins = $state<InstalledPlugin[]>([]);

	/** Provider plugins (definitions from enabled provider plugins) */
	providerPlugins = $state<ProviderDefinition[]>([]);

	/** Loading state */
	isLoading = $state(false);

	/** Error state */
	error = $state<string | null>(null);

	/** Is initialized */
	private initialized = false;

	/**
	 * Initialize plugin state
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;

		console.log("[PluginState] Initializing...");

		try {
			await this.refreshPlugins();
			this.initialized = true;
			console.log("[PluginState] Initialized successfully");
		} catch (error) {
			console.error("[PluginState] Initialization failed:", error);
			this.error = error instanceof Error ? error.message : "Failed to initialize plugins";
		}
	}

	/**
	 * Refresh plugin lists
	 */
	async refreshPlugins(): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			// Get all installed plugins
			this.installedPlugins = await pluginService.getInstalledPlugins();

			// Get enabled plugins
			this.enabledPlugins = await pluginService.getEnabledPlugins();

			// Get provider plugins
			this.providerPlugins = await pluginService.getProviderPlugins();

			console.log(
				`[PluginState] Refreshed: ${this.installedPlugins.length} installed, ` +
					`${this.enabledPlugins.length} enabled, ${this.providerPlugins.length} providers`,
			);
		} catch (error) {
			console.error("[PluginState] Failed to refresh plugins:", error);
			this.error = error instanceof Error ? error.message : "Failed to refresh plugins";
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Get plugin by ID
	 */
	getPlugin(pluginId: string): InstalledPlugin | undefined {
		return this.installedPlugins.find((p) => p.metadata.id === pluginId);
	}

	/**
	 * Get provider plugin by ID
	 */
	getProviderPlugin(providerId: string): ProviderDefinition | undefined {
		return this.providerPlugins.find((p) => p.id === providerId);
	}

	/**
	 * Check if plugin is installed
	 */
	isPluginInstalled(pluginId: string): boolean {
		return this.installedPlugins.some((p) => p.metadata.id === pluginId);
	}

	/**
	 * Check if plugin is enabled
	 */
	isPluginEnabled(pluginId: string): boolean {
		return this.enabledPlugins.some((p) => p.metadata.id === pluginId);
	}

	/**
	 * Install a plugin
	 */
	async installPlugin(source: PluginSource): Promise<InstalledPlugin> {
		this.isLoading = true;
		this.error = null;

		try {
			console.log("[PluginState] Installing plugin from source:", source);
			const plugin = await pluginService.installPlugin(source);

			// Refresh plugin lists
			await this.refreshPlugins();

			console.log("[PluginState] Plugin installed:", plugin.metadata.id);
			return plugin;
		} catch (error) {
			console.error("[PluginState] Failed to install plugin:", error);
			this.error = error instanceof Error ? error.message : "Failed to install plugin";
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Uninstall a plugin
	 */
	async uninstallPlugin(pluginId: string): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			console.log("[PluginState] Uninstalling plugin:", pluginId);
			await pluginService.uninstallPlugin(pluginId);

			// Refresh plugin lists
			await this.refreshPlugins();

			console.log("[PluginState] Plugin uninstalled:", pluginId);
		} catch (error) {
			console.error("[PluginState] Failed to uninstall plugin:", error);
			this.error = error instanceof Error ? error.message : "Failed to uninstall plugin";
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Enable a plugin
	 */
	async enablePlugin(pluginId: string): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			console.log("[PluginState] Enabling plugin:", pluginId);
			await pluginService.enablePlugin(pluginId);

			// Refresh plugin lists
			await this.refreshPlugins();

			console.log("[PluginState] Plugin enabled:", pluginId);
		} catch (error) {
			console.error("[PluginState] Failed to enable plugin:", error);
			this.error = error instanceof Error ? error.message : "Failed to enable plugin";
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Disable a plugin
	 */
	async disablePlugin(pluginId: string): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			console.log("[PluginState] Disabling plugin:", pluginId);
			await pluginService.disablePlugin(pluginId);

			// Refresh plugin lists
			await this.refreshPlugins();

			console.log("[PluginState] Plugin disabled:", pluginId);
		} catch (error) {
			console.error("[PluginState] Failed to disable plugin:", error);
			this.error = error instanceof Error ? error.message : "Failed to disable plugin";
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Update a plugin
	 */
	async updatePlugin(pluginId: string): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			console.log("[PluginState] Updating plugin:", pluginId);
			await pluginService.updatePlugin(pluginId);

			// Refresh plugin lists
			await this.refreshPlugins();

			console.log("[PluginState] Plugin updated:", pluginId);
		} catch (error) {
			console.error("[PluginState] Failed to update plugin:", error);
			this.error = error instanceof Error ? error.message : "Failed to update plugin";
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Reload a plugin
	 */
	async reloadPlugin(pluginId: string): Promise<void> {
		this.isLoading = true;
		this.error = null;

		try {
			console.log("[PluginState] Reloading plugin:", pluginId);
			await pluginService.reloadPlugin(pluginId);

			// Refresh plugin lists
			await this.refreshPlugins();

			console.log("[PluginState] Plugin reloaded:", pluginId);
		} catch (error) {
			console.error("[PluginState] Failed to reload plugin:", error);
			this.error = error instanceof Error ? error.message : "Failed to reload plugin";
			throw error;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Get plugin configuration
	 */
	async getPluginConfig(pluginId: string): Promise<Record<string, unknown>> {
		try {
			return await pluginService.getPluginConfig(pluginId);
		} catch (error) {
			console.error("[PluginState] Failed to get plugin config:", error);
			throw error;
		}
	}

	/**
	 * Set plugin configuration
	 */
	async setPluginConfig(pluginId: string, config: Record<string, unknown>): Promise<void> {
		try {
			// Serialize config to remove Svelte Proxy objects
			const serializedConfig = JSON.parse(JSON.stringify(config));

			console.log("[PluginState] Setting plugin config:", pluginId, serializedConfig);
			await pluginService.setPluginConfig(pluginId, serializedConfig);
			console.log("[PluginState] Plugin config updated:", pluginId);
		} catch (error) {
			console.error("[PluginState] Failed to set plugin config:", error);
			throw error;
		}
	}

	/**
	 * Get plugin configuration value
	 */
	async getPluginConfigValue(pluginId: string, key: string): Promise<unknown> {
		try {
			return await pluginService.getPluginConfigValue(pluginId, key);
		} catch (error) {
			console.error("[PluginState] Failed to get plugin config value:", error);
			throw error;
		}
	}

	/**
	 * Set plugin configuration value
	 */
	async setPluginConfigValue(pluginId: string, key: string, value: unknown): Promise<void> {
		try {
			// Serialize value to remove Svelte Proxy objects if it's an object
			const serializedValue =
				typeof value === "object" && value !== null ? JSON.parse(JSON.stringify(value)) : value;

			console.log("[PluginState] Setting plugin config value:", pluginId, key, serializedValue);
			await pluginService.setPluginConfigValue(pluginId, key, serializedValue);
			console.log("[PluginState] Plugin config value updated:", pluginId, key);
		} catch (error) {
			console.error("[PluginState] Failed to set plugin config value:", error);
			throw error;
		}
	}

	/**
	 * Get builtin plugins
	 */
	get builtinPlugins(): InstalledPlugin[] {
		return this.installedPlugins.filter((p) => p.metadata.builtin);
	}

	/**
	 * Get third-party plugins
	 */
	get thirdPartyPlugins(): InstalledPlugin[] {
		return this.installedPlugins.filter((p) => !p.metadata.builtin);
	}

	/**
	 * Get plugins by type
	 */
	getPluginsByType(type: string): InstalledPlugin[] {
		return this.installedPlugins.filter((p) => p.metadata.type === type);
	}

	/**
	 * Get provider plugins (installed plugins with type "provider")
	 */
	get installedProviderPlugins(): InstalledPlugin[] {
		return this.getPluginsByType("provider");
	}

	/**
	 * Fetch models from a provider using its plugin
	 */
	async fetchModelsFromProvider(provider: ModelProvider): Promise<Model[]> {
		try {
			console.log(`[PluginState] Fetching models for provider: ${provider.id}`);
			const models = await pluginService.fetchModelsFromProvider(provider);
			console.log(`[PluginState] Fetched ${models.length} models for ${provider.id}`);
			return models;
		} catch (error) {
			console.error(`[PluginState] Failed to fetch models:`, error);
			throw error;
		}
	}
}

// Singleton instance
export const pluginState = new PluginState();

// Initialize plugin state when module loads
if (typeof window !== "undefined") {
	pluginState.initialize().catch((error) => {
		console.error("[PluginState] Auto-initialization failed:", error);
	});
}
