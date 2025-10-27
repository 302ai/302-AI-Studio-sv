/**
 * Debug Provider Plugin
 *
 * A test plugin that implements all message hooks to demonstrate and test
 * the plugin system's hook functionality.
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
	PluginAPI,
} from "../../../../src/lib/plugin-system/types";
import type { Model, ModelProvider } from "../../../../src/shared/types";

/**
 * Debug Provider Plugin Class
 * This plugin is used for testing hook functionality
 */
export class DebugProviderPlugin implements ProviderPlugin {
	api?: PluginAPI;

	private config = {
		enabled: false,
		logLevel: "verbose" as "silent" | "normal" | "verbose",
		addPrefix: true,
		prefix: "[DEBUG]",
	};

	/**
	 * Initialize plugin
	 */
	async initialize(api: PluginAPI): Promise<void> {
		this.api = api;

		// Load configuration
		try {
			const savedConfig = await api.storage.getAllConfig();
			this.config = { ...this.config, ...savedConfig };
			console.log("[DebugPlugin] Loaded config from storage:", this.config);
		} catch (error) {
			console.warn("[DebugPlugin] Failed to load config:", error);
		}

		this.log("normal", "🔧 Debug Provider Plugin initialized");
		this.log("verbose", "Configuration:", this.config);
	}

	/**
	 * Cleanup plugin
	 */
	async cleanup(): Promise<void> {
		this.log("normal", "🔧 Debug Provider Plugin cleanup");
	}

	/**
	 * Get provider definition
	 */
	getProviderDefinition(): ProviderDefinition {
		return {
			id: "debug",
			name: "Debug Provider",
			apiType: "debug",
			icon: undefined,
			websites: {
				official: "https://302.ai",
				apiKey: "https://302.ai",
				docs: "https://302.ai/docs",
				models: "https://302.ai/models",
				defaultBaseUrl: "http://localhost:8089",
			},
			defaultBaseUrl: "http://localhost:8089",
			requiresAuth: false,
			authMethods: [],
			configSchema: {},
		};
	}

	/**
	 * Handle authentication (not needed for debug provider)
	 */
	async onAuthenticate(_context: AuthContext): Promise<AuthResult> {
		this.log("verbose", "🔐 onAuthenticate called");
		return { success: true };
	}

	/**
	 * Fetch models (returns empty array as this is a debug provider)
	 */
	async onFetchModels(_provider: ModelProvider): Promise<Model[]> {
		this.log("verbose", "📋 onFetchModels called");
		return [];
	}

	/**
	 * Hook: Before sending message
	 * Demonstrates message modification before sending
	 */
	async onBeforeSendMessage(context: MessageContext): Promise<MessageContext> {
		// Reload config to get latest settings
		await this.reloadConfig();

		if (!this.config.enabled) {
			return context;
		}

		this.log("normal", "📤 onBeforeSendMessage hook triggered");
		this.log("verbose", "Original context:", {
			messagesCount: context.messages.length,
			model: context.model.id,
			provider: context.provider.name,
			parameters: context.parameters,
		});

		// Example modification: Add prefix to user message
		if (this.config.addPrefix && context.userMessage) {
			const modifiedContext = { ...context };

			// Add prefix to the user message content
			const userMsg = modifiedContext.userMessage as any;
			if (userMsg.content && typeof userMsg.content === "string") {
				userMsg.content = `${this.config.prefix} ${userMsg.content}`;
				this.log("verbose", "✏️ Added prefix to message:", userMsg.content);
			}

			return modifiedContext;
		}

		return context;
	}

	/**
	 * Hook: After message is sent
	 * Demonstrates post-processing and logging
	 */
	async onAfterSendMessage(context: MessageContext, response: AIResponse): Promise<void> {
		// Reload config to get latest settings
		await this.reloadConfig();

		if (!this.config.enabled) {
			return;
		}

		this.log("normal", "📥 onAfterSendMessage hook triggered");

		// Safely access response properties
		if (response && typeof response === "object") {
			this.log("verbose", "Response details:", {
				model: response.model || "unknown",
				finishReason: response.finishReason || "unknown",
				usage: response.usage || null,
			});
		} else {
			this.log("verbose", "Response is not an object:", response);
		}

		// Calculate and log statistics
		const stats = {
			totalMessages: context.messages?.length || 0,
			promptTokens: response?.usage?.promptTokens || 0,
			completionTokens: response?.usage?.completionTokens || 0,
			totalTokens: response?.usage?.totalTokens || 0,
		};

		this.log("normal", "📊 Message statistics:", stats);

		// Log to storage if verbose mode
		if (this.config.logLevel === "verbose") {
			try {
				await this.api?.storage.setData("lastMessageStats", {
					timestamp: new Date().toISOString(),
					...stats,
				});
			} catch (error) {
				console.warn("[DebugPlugin] Failed to save stats:", error);
			}
		}
	}

	/**
	 * Hook: Process stream chunks
	 * Demonstrates chunk modification
	 */
	async onStreamChunk(chunk: StreamChunk): Promise<StreamChunk> {
		// Reload config to get latest settings
		await this.reloadConfig();

		if (!this.config.enabled) {
			return chunk;
		}

		if (this.config.logLevel === "verbose") {
			this.log("verbose", "🌊 Stream chunk:", {
				type: chunk.type,
				hasText: !!chunk.text,
				hasToolCall: !!chunk.toolCall,
			});
		}

		return chunk;
	}

	/**
	 * Hook: Handle errors
	 * Demonstrates custom error handling
	 */
	async onError(context: ErrorContext): Promise<ErrorHandleResult> {
		// Reload config to get latest settings
		await this.reloadConfig();

		if (!this.config.enabled) {
			return { handled: false };
		}

		this.log("normal", "❌ onError hook triggered");
		this.log("verbose", "Error details:", {
			error: context.error.message,
			source: context.source,
			provider: context.provider?.name,
			model: context.model?.id,
		});

		// Example: Suggest retry for specific errors
		const errorMessage = context.error.message.toLowerCase();

		if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
			this.log("normal", "🔄 Rate limit detected, suggesting retry in 30s");
			return {
				handled: true,
				retry: true,
				retryDelay: 30000,
				message: "Rate limit hit - will retry in 30 seconds",
			};
		}

		if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
			this.log("normal", "🔄 Network error detected, suggesting immediate retry");
			return {
				handled: true,
				retry: true,
				retryDelay: 1000,
				message: "Network error - retrying...",
			};
		}

		// Log error for debugging
		try {
			await this.api?.storage.setData("lastError", {
				timestamp: new Date().toISOString(),
				error: context.error.message,
				source: context.source,
				provider: context.provider?.name,
				model: context.model?.id,
			});
		} catch (storageError) {
			console.warn("[DebugPlugin] Failed to save error:", storageError);
		}

		// Don't handle by default, let the system handle it
		return { handled: false };
	}

	/**
	 * Reload configuration from storage
	 * Call this before each hook to get latest settings
	 */
	private async reloadConfig(): Promise<void> {
		if (!this.api) return;

		try {
			const savedConfig = await this.api.storage.getAllConfig();
			this.config = { ...this.config, ...savedConfig };
		} catch (error) {
			// Silently fail, keep current config
		}
	}

	/**
	 * Logging helper
	 */
	private log(level: "silent" | "normal" | "verbose", message: string, data?: unknown): void {
		const levels = { silent: 0, normal: 1, verbose: 2 };
		const currentLevel = levels[this.config.logLevel];
		const messageLevel = levels[level];

		if (messageLevel <= currentLevel) {
			const prefix = "[DebugPlugin]";
			if (data !== undefined) {
				console.log(prefix, message, data);
			} else {
				console.log(prefix, message);
			}

			// Also use plugin API logger if available
			if (this.api?.logger) {
				if (data !== undefined) {
					this.api.logger.info(`${message} ${JSON.stringify(data)}`);
				} else {
					this.api.logger.info(message);
				}
			}
		}
	}
}
