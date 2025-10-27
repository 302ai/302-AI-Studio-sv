/**
 * Plugin System Type Definitions
 *
 * This file defines all types for the 302-AI-Studio plugin system.
 * Plugins can extend functionality by implementing these interfaces.
 */

import type { Model, ModelProvider } from "@shared/types";
import type { ChatMessage } from "$lib/types/chat";
import type { SvelteComponent } from "svelte";

/* ============================================================================
 * Plugin Metadata Types
 * ========================================================================= */

/**
 * Plugin type enum
 */
export type PluginType = "provider" | "extension" | "theme" | "tool";

/**
 * Plugin permission types
 */
export type PluginPermission =
	| "network" // Access to network APIs
	| "filesystem" // Access to file system
	| "storage" // Access to local storage
	| "ui" // Ability to register UI components
	| "hooks" // Ability to register hooks
	| "ipc" // Access to IPC communication
	| "clipboard" // Access to clipboard
	| "notifications"; // Show notifications

/**
 * Plugin status
 */
export type PluginStatus = "installed" | "enabled" | "disabled" | "error" | "updating";

/**
 * Plugin metadata from plugin.json
 */
export interface PluginMetadata {
	/** Unique plugin identifier (e.g., "com.example.myprovider") */
	id: string;

	/** Plugin display name */
	name: string;

	/** Plugin version (semver) */
	version: string;

	/** Plugin type */
	type: PluginType;

	/** Short description */
	description: string;

	/** Plugin author */
	author: string;

	/** Plugin homepage URL */
	homepage?: string;

	/** Plugin repository URL */
	repository?: string;

	/** Plugin icon path (relative to plugin directory) */
	icon?: string;

	/** Required permissions */
	permissions: PluginPermission[];

	/** Compatible application version range */
	compatibleVersion: string;

	/** Main process entry point */
	main?: string;

	/** Renderer process entry point */
	renderer?: string;

	/** Plugin tags for categorization */
	tags?: string[];

	/** Is this a builtin (official) plugin? */
	builtin?: boolean;

	/** Plugin configuration schema (JSON Schema) */
	configSchema?: Record<string, unknown>;

	/** Default configuration values */
	defaultConfig?: Record<string, unknown>;

	/** I18n resources */
	locales?: string[];
}

/**
 * Installed plugin information
 */
export interface InstalledPlugin {
	/** Plugin metadata */
	metadata: PluginMetadata;

	/** Installation path */
	path: string;

	/** Current status */
	status: PluginStatus;

	/** Installation timestamp */
	installedAt: Date;

	/** Last update timestamp */
	updatedAt?: Date;

	/** User configuration */
	config: Record<string, unknown>;

	/** Error message if status is "error" */
	error?: string;
}

/* ============================================================================
 * Plugin API Types
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

/**
 * Plugin UI API
 */
export interface PluginUIAPI {
	/** Register a component */
	registerComponent(name: string, component: typeof SvelteComponent): void;

	/** Show a notification */
	showNotification(message: string, type?: "info" | "success" | "warning" | "error"): void;

	/** Show a dialog */
	showDialog(options: DialogOptions): Promise<DialogResult>;

	/** Open a custom window */
	openWindow(options: WindowOptions): Promise<void>;
}

/**
 * Plugin logger API
 */
export interface PluginLoggerAPI {
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

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

/* ============================================================================
 * Hook Types
 * ========================================================================= */

/**
 * Hook handler function
 */
export type HookHandler<T = unknown> = (context: T) => Promise<T> | T;

/**
 * Hook execution options
 */
export interface HookOptions {
	/** Stop execution on first error */
	stopOnError?: boolean;

	/** Timeout in milliseconds */
	timeout?: number;

	/** Priority (higher priority hooks execute first) */
	priority?: number;
}

/**
 * Hook execution result
 */
export interface HookResult<T = unknown> {
	/** Modified context */
	context: T;

	/** Should stop further execution */
	stop?: boolean;

	/** Error if any */
	error?: Error;
}

/**
 * Authentication context for onAuthenticate hook
 */
export interface AuthContext {
	/** Provider instance */
	provider: ModelProvider;

	/** Authentication method */
	method: "apikey" | "oauth" | "custom";

	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Authentication result
 */
export interface AuthResult {
	/** Authentication success */
	success: boolean;

	/** API key or access token */
	apiKey?: string;

	/** Refresh token (for OAuth) */
	refreshToken?: string;

	/** Token expiration timestamp */
	expiresAt?: Date;

	/** Additional metadata to store */
	metadata?: Record<string, unknown>;

	/** Error message if failed */
	error?: string;
}

/**
 * Message context for message-related hooks
 */
export interface MessageContext {
	/** Current messages in the conversation */
	messages: ChatMessage[];

	/** New user message being sent */
	userMessage: ChatMessage;

	/** Selected model */
	model: Model;

	/** Provider instance */
	provider: ModelProvider;

	/** Chat parameters */
	parameters: {
		temperature: number | null;
		topP: number | null;
		maxTokens: number | null;
		frequencyPenalty: number | null;
		presencePenalty: number | null;
	};

	/** Additional options */
	options: {
		isThinkingActive: boolean;
		isOnlineSearchActive: boolean;
		isMCPActive: boolean;
		mcpServerIds: string[];
		autoParseUrl: boolean;
		speedOptions: {
			enabled: boolean;
			speed: number;
		};
	};

	/** Additional metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Stream response chunk
 */
export interface StreamChunk {
	/** Chunk type */
	type: "text" | "tool-call" | "reasoning" | "error" | "done";

	/** Text content (for text chunks) */
	text?: string;

	/** Tool call data (for tool-call chunks) */
	toolCall?: {
		id: string;
		name: string;
		args: unknown;
	};

	/** Reasoning content (for reasoning chunks) */
	reasoning?: string;

	/** Error (for error chunks) */
	error?: Error;

	/** Metadata */
	metadata?: Record<string, unknown>;
}

/**
 * AI response (full response after streaming completes)
 */
export interface AIResponse {
	/** Response message */
	message: ChatMessage;

	/** Token usage */
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};

	/** Model used */
	model: string;

	/** Finish reason */
	finishReason: "stop" | "length" | "tool-calls" | "error";

	/** Metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Error context for onError hook
 */
export interface ErrorContext {
	/** Error instance */
	error: Error;

	/** Error source */
	source: "authentication" | "api" | "network" | "plugin" | "unknown";

	/** Provider instance if applicable */
	provider?: ModelProvider;

	/** Model instance if applicable */
	model?: Model;

	/** Additional context */
	metadata?: Record<string, unknown>;
}

/**
 * Error handle result
 */
export interface ErrorHandleResult {
	/** Whether the error was handled */
	handled: boolean;

	/** Whether to retry */
	retry?: boolean;

	/** Retry delay in milliseconds */
	retryDelay?: number;

	/** Custom error message to show to user */
	message?: string;
}

/**
 * Component registry for UI extensions
 */
export interface ComponentRegistry {
	/** Authentication dialog component */
	authDialog?: string;

	/** Settings page component */
	settingsPage?: string;

	/** Model selector component */
	modelSelector?: string;

	/** Custom message renderer component */
	messageRenderer?: string;

	/** Additional custom components */
	[key: string]: string | undefined;
}

/* ============================================================================
 * Provider Plugin Interface
 * ========================================================================= */

/**
 * Provider definition returned by plugin
 */
export interface ProviderDefinition {
	/** Unique provider ID */
	id: string;

	/** Provider display name */
	name: string;

	/** API type */
	apiType: string;

	/** Provider icon URL */
	icon?: string;

	/** Provider websites */
	websites: {
		official: string;
		apiKey: string;
		docs: string;
		models: string;
		defaultBaseUrl: string;
	};

	/** Default base URL */
	defaultBaseUrl: string;

	/** Whether this provider requires authentication */
	requiresAuth: boolean;

	/** Supported authentication methods */
	authMethods: ("apikey" | "oauth" | "custom")[];

	/** Configuration schema */
	configSchema?: Record<string, unknown>;
}

/**
 * Provider Plugin Interface
 * Plugins that provide AI provider functionality should implement this interface
 */
export interface ProviderPlugin {
	/** Plugin instance (injected by plugin manager) */
	api?: PluginAPI;

	/**
	 * Get provider definition
	 */
	getProviderDefinition(): ProviderDefinition | Promise<ProviderDefinition>;

	/**
	 * Initialize provider
	 * Called when the plugin is loaded
	 */
	initialize?(api: PluginAPI): Promise<void> | void;

	/**
	 * Cleanup provider
	 * Called when the plugin is unloaded
	 */
	cleanup?(): Promise<void> | void;

	/**
	 * Handle authentication
	 * @param context Authentication context
	 * @returns Authentication result
	 */
	onAuthenticate(context: AuthContext): Promise<AuthResult>;

	/**
	 * Fetch available models from provider
	 * @param provider Provider instance
	 * @returns Array of models
	 */
	onFetchModels(provider: ModelProvider): Promise<Model[]>;

	/**
	 * Hook: Called before sending a message
	 * Can modify message, parameters, or cancel sending
	 * @param context Message context
	 * @returns Modified context
	 */
	onBeforeSendMessage?(context: MessageContext): Promise<MessageContext>;

	/**
	 * Hook: Custom message sending logic
	 * If implemented, this will override the default API call
	 * @param context Message context
	 * @returns Async iterable of stream chunks
	 */
	onSendMessage?(context: MessageContext): AsyncIterable<StreamChunk>;

	/**
	 * Hook: Called after message is sent
	 * @param context Message context
	 * @param response AI response
	 */
	onAfterSendMessage?(context: MessageContext, response: AIResponse): Promise<void>;

	/**
	 * Hook: Process stream chunks
	 * Can modify or filter chunks
	 * @param chunk Stream chunk
	 * @returns Modified chunk
	 */
	onStreamChunk?(chunk: StreamChunk): Promise<StreamChunk>;

	/**
	 * Hook: Handle errors
	 * @param context Error context
	 * @returns Error handle result
	 */
	onError?(context: ErrorContext): Promise<ErrorHandleResult>;

	/**
	 * Register UI components
	 * @returns Component registry
	 */
	onRegisterComponents?(): ComponentRegistry | Promise<ComponentRegistry> | undefined;
}

/* ============================================================================
 * Plugin Manager Types
 * ========================================================================= */

/**
 * Plugin manager interface
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
 * Plugin registry interface
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
 * Hook manager interface
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

/* ============================================================================
 * UI Types
 * ========================================================================= */

/**
 * Dialog options
 */
export interface DialogOptions {
	/** Dialog title */
	title: string;

	/** Dialog message */
	message: string;

	/** Dialog type */
	type?: "info" | "warning" | "error" | "question";

	/** Button labels */
	buttons?: string[];

	/** Default button index */
	defaultId?: number;

	/** Cancel button index */
	cancelId?: number;
}

/**
 * Dialog result
 */
export interface DialogResult {
	/** Selected button index */
	response: number;

	/** Whether dialog was cancelled */
	cancelled: boolean;
}

/**
 * Window options
 */
export interface WindowOptions {
	/** Window URL */
	url: string;

	/** Window title */
	title?: string;

	/** Window width */
	width?: number;

	/** Window height */
	height?: number;

	/** Is modal */
	modal?: boolean;

	/** Additional options */
	[key: string]: unknown;
}

/**
 * Request options for HTTP client
 */
export interface RequestOptions {
	/** Request URL */
	url?: string;

	/** HTTP method */
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

	/** Request headers */
	headers?: Record<string, string>;

	/** Request body */
	body?: unknown;

	/** Query parameters */
	params?: Record<string, string | number>;

	/** Request timeout */
	timeout?: number;

	/** Response type */
	responseType?: "json" | "text" | "blob" | "arraybuffer";
}

/* ============================================================================
 * Plugin Market Types
 * ========================================================================= */

/**
 * Plugin market entry
 */
export interface PluginMarketEntry {
	/** Plugin metadata */
	metadata: PluginMetadata;

	/** Download URL */
	downloadUrl: string;

	/** Download count */
	downloads: number;

	/** Rating (0-5) */
	rating: number;

	/** Number of ratings */
	ratingCount: number;

	/** Featured */
	featured: boolean;

	/** Screenshots */
	screenshots?: string[];

	/** Readme content */
	readme?: string;

	/** Changelog */
	changelog?: string;

	/** Published date */
	publishedAt: Date;

	/** Last updated */
	updatedAt: Date;
}

/**
 * Plugin source
 */
export type PluginSource =
	| { type: "marketplace"; id: string }
	| { type: "url"; url: string }
	| { type: "local"; path: string };

export default {};
