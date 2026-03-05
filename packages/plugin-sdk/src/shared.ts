/**
 * Shared Business Types
 *
 * Types for models, providers, and chat messages
 * These are shared between the plugin system and the main application
 */

import type { UIMessage } from "ai";

/* ============================================================================
 * Model Types
 * ========================================================================= */

/**
 * Model type enum
 */
export type ModelType = "language" | "image-generation" | "tts" | "embedding" | "rerank";

/**
 * Model capability (e.g., "vision", "function_call", "reasoning")
 */
export type ModelCapability = string;

/**
 * AI Model definition
 */
export interface Model {
	id: string;
	name: string;
	remark: string;
	providerId: string;
	capabilities: Set<ModelCapability>;
	type: ModelType;
	custom: boolean;
	enabled: boolean;
	collected: boolean;
	isFeatured: boolean;
	isAddedByUser?: boolean;
	is_custom_model?: boolean;
	openai_compatible?: boolean;
}

/* ============================================================================
 * Model Provider Types
 * ========================================================================= */

/**
 * Model provider websites information
 */
export interface ModelProviderWebsites {
	official: string;
	apiKey: string;
	docs: string;
	models: string;
	defaultBaseUrl: string;
}

/**
 * Model provider status
 */
export type ModelProviderStatus = "pending" | "connected" | "error" | "disabled";

/**
 * Model provider instance
 */
export interface ModelProvider {
	id: string;
	name: string;
	apiType: "302ai" | "openai" | "anthropic" | "gemini";
	apiKey: string;
	baseUrl: string;
	enabled: boolean;
	custom?: boolean;
	status: ModelProviderStatus;
	websites: ModelProviderWebsites;
	icon?: string;
	autoUpdateModels?: boolean;
	lastAutoUpdateDate?: string;
}

/* ============================================================================
 * Chat Message Types
 * ========================================================================= */

/**
 * Result metadata from 302.AI Claude Code
 */
export interface ResultMetadata {
	type?: string;
	subtype?: string;
	is_error?: boolean;
	duration_ms?: number;
	duration_api_ms?: number;
	num_turns?: number;
	content?: string;
	session_id?: string;
	total_cost_usd?: number;
	uuid?: string;
}

/**
 * Message metadata
 */
export interface MessageMetadata {
	createdAt?: string;
	model?: string;
	attachments?: Array<{
		id: string;
		name: string;
		type: string;
		size: number;
		filePath: string;
		preview?: string;
		textContent?: string;
	}>;
	fileContentPartIndex?: number;
	feedback?: "like" | "dislike";
	/** Result metadata from 302.AI Claude Code */
	result?: ResultMetadata;
	/** User Prompt Template related fields */
	userPromptTemplateContent?: string;
	userPromptTemplateVariables?: string[];
	userPromptTemplateMap?: Record<string, string>;
}

/**
 * Chat tools type (empty for now, can be extended)
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ChatTools = {};

/**
 * Custom UI data types (extensible)
 */
export type CustomUIDataTypes = {
	[x: string]: unknown;
};

/**
 * Chat message type
 * Based on ai package's UIMessage with custom metadata
 */
export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>;
