/**
 * Hook System Types
 *
 * Types for plugin hooks, contexts, and responses
 */

import type { ChatMessage, Model, ModelProvider } from "./shared";
import type { ComponentRegistry } from "./ui";

/* ============================================================================
 * Hook Handler Types
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

/* ============================================================================
 * Authentication Hook Types
 * ========================================================================= */

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

/* ============================================================================
 * Message Hook Types
 * ========================================================================= */

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

/* ============================================================================
 * Error Hook Types
 * ========================================================================= */

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

/* ============================================================================
 * Re-export ComponentRegistry
 * ========================================================================= */

export type { ComponentRegistry };
