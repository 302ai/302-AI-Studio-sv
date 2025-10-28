/**
 * Provider Plugin Types
 *
 * Types for provider plugins that add AI provider functionality
 */

import type { PluginAPI } from "./api";
import type {
	AIResponse,
	AuthContext,
	AuthResult,
	ComponentRegistry,
	ErrorContext,
	ErrorHandleResult,
	MessageContext,
	StreamChunk,
} from "./hooks";
import type { Model, ModelProvider } from "./shared";

/* ============================================================================
 * Provider Definition
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

/* ============================================================================
 * Provider Plugin Interface
 * ========================================================================= */

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
 * Re-export Hook Types (for convenience)
 * ========================================================================= */

export type {
	AuthContext,
	AuthResult,
	MessageContext,
	StreamChunk,
	AIResponse,
	ErrorContext,
	ErrorHandleResult,
	ComponentRegistry,
} from "./hooks";
