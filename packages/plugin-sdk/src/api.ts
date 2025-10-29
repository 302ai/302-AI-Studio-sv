/**
 * Plugin API Types
 *
 * Types for the Plugin API provided to plugins
 * This is the safe API that plugins can use to interact with the application
 */

import type { PluginMetadata } from "./metadata";
import type { DialogOptions, DialogResult, RequestOptions, WindowOptions } from "./ui";
import type { HookHandler } from "./hooks";

/* ============================================================================
 * Plugin API Interface
 * ========================================================================= */

/**
 * Plugin API provided to plugins
 * This is the safe API that plugins can use to interact with the application
 */
export interface PluginAPI {
	/** Plugin metadata */
	readonly metadata: PluginMetadata;

	/** Storage API */
	storage: PluginStorageAPI;

	/** Hook API */
	hooks: PluginHookAPI;

	/** UI API */
	ui: PluginUIAPI;

	/** Logger API */
	logger: PluginLoggerAPI;

	/** HTTP Client API */
	http: PluginHttpAPI;

	/** I18n API */
	i18n: PluginI18nAPI;
}

/* ============================================================================
 * Storage API
 * ========================================================================= */

/**
 * Plugin storage API
 */
export interface PluginStorageAPI {
	/** Get configuration value */
	getConfig<T = unknown>(key: string): Promise<T | null>;

	/** Set configuration value */
	setConfig<T = unknown>(key: string, value: T): Promise<void>;

	/** Remove configuration value */
	removeConfig(key: string): Promise<void>;

	/** Get all configuration */
	getAllConfig(): Promise<Record<string, unknown>>;

	/** Get plugin private data */
	getData<T = unknown>(key: string): Promise<T | null>;

	/** Set plugin private data */
	setData<T = unknown>(key: string, value: T): Promise<void>;

	/** Remove plugin private data */
	removeData(key: string): Promise<void>;
}

/* ============================================================================
 * Hook API
 * ========================================================================= */

/**
 * Plugin hook API
 */
export interface PluginHookAPI {
	/** Register a hook handler */
	register<T = unknown>(hookName: string, handler: HookHandler<T>): void;

	/** Unregister a hook handler */
	unregister(hookName: string, handler: HookHandler): void;

	/** Trigger a hook (for extension plugins) */
	trigger<T = unknown>(hookName: string, context: T): Promise<T>;
}

/* ============================================================================
 * UI API
 * ========================================================================= */

/**
 * Plugin UI API
 */
export interface PluginUIAPI {
	/** Register a component */
	registerComponent(name: string, component: unknown): void;

	/** Show a notification */
	showNotification(message: string, type?: "info" | "success" | "warning" | "error"): void;

	/** Show a dialog */
	showDialog(options: DialogOptions): Promise<DialogResult>;

	/** Open a custom window */
	openWindow(options: WindowOptions): Promise<void>;
}

/* ============================================================================
 * Logger API
 * ========================================================================= */

/**
 * Plugin logger API
 */
export interface PluginLoggerAPI {
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

/* ============================================================================
 * HTTP API
 * ========================================================================= */

/**
 * Plugin HTTP client API
 */
export interface PluginHttpAPI {
	get<T = unknown>(url: string, options?: RequestOptions): Promise<T>;
	post<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T>;
	put<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T>;
	delete<T = unknown>(url: string, options?: RequestOptions): Promise<T>;
	request<T = unknown>(options: RequestOptions): Promise<T>;
}

/* ============================================================================
 * I18n API
 * ========================================================================= */

/**
 * Plugin i18n API
 */
export interface PluginI18nAPI {
	/** Get translated message */
	t(key: string, params?: Record<string, string | number>): string;

	/** Get current locale */
	getLocale(): string;

	/** Add translation resources */
	addMessages(locale: string, messages: Record<string, string>): void;
}
