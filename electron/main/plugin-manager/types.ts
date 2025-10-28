/**
 * Plugin Manager Internal Types
 *
 * Internal types used by the plugin manager implementation
 * These are NOT exposed in the plugin SDK
 */

import type {
	HookHandler,
	HookOptions,
	InstalledPlugin,
	ProviderPlugin,
} from "@302ai/studio-plugin-sdk";

/**
 * Plugin manager interface (internal)
 */
export interface IPluginManager {
	/** Load all plugins from directory */
	loadPlugins(): Promise<void>;

	/** Load a single plugin */
	loadPlugin(pluginPath: string): Promise<InstalledPlugin>;

	/** Unload a plugin */
	unloadPlugin(pluginId: string): Promise<void>;

	/** Enable a plugin */
	enablePlugin(pluginId: string): Promise<void>;

	/** Disable a plugin */
	disablePlugin(pluginId: string): Promise<void>;

	/** Get all installed plugins */
	getInstalledPlugins(): InstalledPlugin[];

	/** Get a specific plugin */
	getPlugin(pluginId: string): InstalledPlugin | null;

	/** Execute a hook */
	executeHook<T = unknown>(hookName: string, context: T, options?: HookOptions): Promise<T>;

	/** Get provider plugins */
	getProviderPlugins(): ProviderPlugin[];
}

/**
 * Plugin registry interface (internal)
 */
export interface IPluginRegistry {
	/** Register a plugin */
	register(plugin: InstalledPlugin, instance: ProviderPlugin): void;

	/** Unregister a plugin */
	unregister(pluginId: string): void;

	/** Get registered plugin */
	get(pluginId: string): { plugin: InstalledPlugin; instance: ProviderPlugin } | null;

	/** Get all registered plugins */
	getAll(): Map<string, { plugin: InstalledPlugin; instance: ProviderPlugin }>;

	/** Check if plugin is registered */
	has(pluginId: string): boolean;
}

/**
 * Hook manager interface (internal)
 */
export interface IHookManager {
	/** Register a hook handler */
	register<T = unknown>(
		hookName: string,
		pluginId: string,
		handler: HookHandler<T>,
		options?: HookOptions,
	): void;

	/** Unregister a hook handler */
	unregister(hookName: string, pluginId: string): void;

	/** Execute hook handlers */
	execute<T = unknown>(hookName: string, context: T, options?: HookOptions): Promise<T>;

	/** Get registered hooks for a hook name */
	getHooks(
		hookName: string,
	): Array<{ pluginId: string; handler: HookHandler; options?: HookOptions }>;
}
