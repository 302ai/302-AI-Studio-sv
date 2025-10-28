/**
 * Base Provider Plugin
 *
 * Abstract base class for creating provider plugins
 * Provides common functionality and utilities
 */

import type {
	ProviderPlugin,
	ProviderDefinition,
	AuthContext,
	AuthResult,
	MessageContext,
	AIResponse,
	StreamChunk,
	ErrorContext,
	ErrorHandleResult,
	ComponentRegistry,
} from "./provider";
import type { PluginAPI } from "./api";
import type { Model, ModelProvider } from "./shared";

/**
 * Base Provider Plugin Class
 * Extend this class to create your own provider plugin
 */
export abstract class BaseProviderPlugin implements ProviderPlugin {
	/** Plugin API instance (injected by plugin manager) */
	api?: PluginAPI;

	/**
	 * Provider ID - must be unique
	 */
	protected abstract providerId: string;

	/**
	 * Provider display name
	 */
	protected abstract providerName: string;

	/**
	 * API type (openai, anthropic, gemini, etc.)
	 */
	protected abstract apiType: string;

	/**
	 * Default base URL for API calls
	 */
	protected abstract defaultBaseUrl: string;

	/**
	 * Provider websites
	 */
	protected abstract websites: {
		official: string;
		apiKey: string;
		docs: string;
		models: string;
	};

	/**
	 * Initialize plugin
	 */
	async initialize(api: PluginAPI): Promise<void> {
		this.api = api;
		this.api.logger.info(`Initializing ${this.providerName} plugin`);
	}

	/**
	 * Cleanup plugin
	 */
	async cleanup(): Promise<void> {
		this.api?.logger.info(`Cleaning up ${this.providerName} plugin`);
	}

	/**
	 * Get provider definition
	 */
	getProviderDefinition(): ProviderDefinition {
		return {
			id: this.providerId,
			name: this.providerName,
			apiType: this.apiType,
			icon: this.getIconUrl(),
			websites: {
				...this.websites,
				defaultBaseUrl: this.defaultBaseUrl,
			},
			defaultBaseUrl: this.defaultBaseUrl,
			requiresAuth: true,
			authMethods: ["apikey"],
			configSchema: this.getConfigSchema(),
		};
	}

	/**
	 * Get icon URL (can be overridden)
	 */
	protected getIconUrl(): string | undefined {
		return undefined;
	}

	/**
	 * Get configuration schema (can be overridden)
	 */
	protected getConfigSchema(): Record<string, unknown> | undefined {
		return {
			type: "object",
			properties: {
				apiKey: {
					type: "string",
					title: "API Key",
					description: "Your API key for authentication",
				},
				baseUrl: {
					type: "string",
					title: "Base URL",
					description: "API base URL (optional)",
					default: this.defaultBaseUrl,
				},
			},
			required: ["apiKey"],
		};
	}

	/**
	 * Handle authentication
	 * Default implementation for API key authentication
	 */
	async onAuthenticate(context: AuthContext): Promise<AuthResult> {
		const { provider } = context;

		// Validate API key exists
		if (!provider.apiKey || provider.apiKey.trim() === "") {
			return {
				success: false,
				error: "API key is required",
			};
		}

		// Test the API key by fetching models
		try {
			await this.testConnection(provider);

			return {
				success: true,
				apiKey: provider.apiKey,
			};
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Authentication failed",
			};
		}
	}

	/**
	 * Test API connection (override to customize)
	 */
	protected async testConnection(provider: ModelProvider): Promise<void> {
		// Default: try to fetch models
		await this.onFetchModels(provider);
	}

	/**
	 * Fetch models from provider
	 * This method must be implemented by subclasses
	 */
	abstract onFetchModels(provider: ModelProvider): Promise<Model[]>;

	/**
	 * Hook: Before send message
	 * Can be overridden to modify messages before sending
	 */
	async onBeforeSendMessage(context: MessageContext): Promise<MessageContext> {
		// Default: pass through
		return context;
	}

	/**
	 * Hook: After send message
	 * Can be overridden to process response
	 */
	async onAfterSendMessage(_context: MessageContext, _response: AIResponse): Promise<void> {
		// Default: no-op
	}

	/**
	 * Hook: Process stream chunk
	 * Can be overridden to modify or filter chunks
	 */
	async onStreamChunk(chunk: StreamChunk): Promise<StreamChunk> {
		// Default: pass through
		return chunk;
	}

	/**
	 * Hook: Handle errors
	 * Can be overridden for custom error handling
	 */
	async onError(context: ErrorContext): Promise<ErrorHandleResult> {
		const { error, source } = context;

		this.api?.logger.error(`Error from ${source}:`, error);

		// Default error handling
		if (error.message.includes("401") || error.message.includes("403")) {
			return {
				handled: true,
				message: "Authentication failed. Please check your API key.",
			};
		}

		if (error.message.includes("429")) {
			return {
				handled: true,
				retry: true,
				retryDelay: 5000,
				message: "Rate limit exceeded. Retrying in 5 seconds...",
			};
		}

		if (error.message.includes("timeout") || error.message.includes("ECONNREFUSED")) {
			return {
				handled: true,
				retry: true,
				retryDelay: 2000,
				message: "Connection timeout. Retrying...",
			};
		}

		return {
			handled: false,
		};
	}

	/**
	 * Register UI components
	 * Can be overridden to provide custom UI
	 */
	onRegisterComponents(): ComponentRegistry | Promise<ComponentRegistry> | undefined {
		return undefined;
	}

	/**
	 * Utility: Make HTTP request with API key
	 */
	protected async httpRequest<T = unknown>(
		url: string,
		options: {
			method?: "GET" | "POST" | "PUT" | "DELETE";
			headers?: Record<string, string>;
			body?: unknown;
			provider: ModelProvider;
		},
	): Promise<T> {
		const { method = "GET", headers = {}, body, provider } = options;

		const requestHeaders = {
			"Content-Type": "application/json",
			...this.getAuthHeaders(provider),
			...headers,
		};

		if (!this.api) {
			throw new Error("Plugin API not initialized");
		}

		return this.api.http.request<T>({
			url,
			method,
			headers: requestHeaders,
			body,
		});
	}

	/**
	 * Get authentication headers for provider
	 * Override this to customize authentication
	 */
	protected getAuthHeaders(provider: ModelProvider): Record<string, string> {
		// Default: Bearer token authentication
		return {
			Authorization: `Bearer ${provider.apiKey}`,
		};
	}

	/**
	 * Utility: Build API URL
	 */
	protected buildApiUrl(provider: ModelProvider, endpoint: string): string {
		const baseUrl = provider.baseUrl || this.defaultBaseUrl;
		const cleanBase = baseUrl.replace(/\/$/, "");
		const cleanEndpoint = endpoint.replace(/^\//, "");

		return `${cleanBase}/${cleanEndpoint}`;
	}

	/**
	 * Utility: Parse model capabilities from model ID
	 */
	protected parseModelCapabilities(modelId: string): Set<string> {
		const capabilities = new Set<string>();

		// Common capability patterns
		const patterns = {
			vision: /vision|gpt-4-turbo|gpt-4o|claude-3|gemini.*pro-vision/i,
			functionCall: /gpt-4|gpt-3.5-turbo|claude-3|gemini.*pro/i,
			reasoning: /o1|o3|thinking/i,
		};

		for (const [capability, pattern] of Object.entries(patterns)) {
			if (pattern.test(modelId)) {
				capabilities.add(capability);
			}
		}

		return capabilities;
	}

	/**
	 * Utility: Parse model type from model ID
	 */
	protected parseModelType(
		modelId: string,
	): "language" | "image-generation" | "tts" | "embedding" | "rerank" {
		if (/dall-e|imagen|stable-diffusion|midjourney/i.test(modelId)) {
			return "image-generation";
		}
		if (/tts|text-to-speech/i.test(modelId)) {
			return "tts";
		}
		if (/embedding|ada/i.test(modelId)) {
			return "embedding";
		}
		if (/rerank/i.test(modelId)) {
			return "rerank";
		}
		return "language";
	}

	/**
	 * Utility: Log with plugin context
	 */
	protected log(
		level: "debug" | "info" | "warn" | "error",
		message: string,
		...args: unknown[]
	): void {
		if (!this.api) return;

		switch (level) {
			case "debug":
				this.api.logger.debug(message, ...args);
				break;
			case "info":
				this.api.logger.info(message, ...args);
				break;
			case "warn":
				this.api.logger.warn(message, ...args);
				break;
			case "error":
				this.api.logger.error(message, ...args);
				break;
		}
	}

	/**
	 * Utility: Show notification
	 */
	protected notify(message: string, type: "info" | "success" | "warning" | "error" = "info"): void {
		this.api?.ui.showNotification(message, type);
	}
}
