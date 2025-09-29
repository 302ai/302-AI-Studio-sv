import type { HF } from "$lib/transport/f-chat-transport";
import { ChatErrorHandler } from "$lib/utils/error-handler";
import { monitorStreamErrors } from "$lib/utils/stream-error-monitor";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import {
	convertToModelMessages,
	extractReasoningMiddleware,
	streamText,
	wrapLanguageModel,
} from "ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addDefinedParams(options: any, params: any) {
	if (params.temperature !== undefined && params.temperature !== null) {
		options.temperature = params.temperature;
	}
	if (params.topP !== undefined && params.topP !== null) {
		options.topP = params.topP;
	}
	if (params.maxTokens !== undefined && params.maxTokens !== null) {
		options.maxOutputTokens = params.maxTokens;
	}
	if (params.frequencyPenalty !== undefined && params.frequencyPenalty !== null) {
		options.frequencyPenalty = params.frequencyPenalty;
	}
	if (params.presencePenalty !== undefined && params.presencePenalty !== null) {
		options.presencePenalty = params.presencePenalty;
	}
}

export const ai302Handler: HF = async ({ messages, abortSignal, body }) => {
	const {
		baseUrl,
		model = "gpt-4o",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isThinkingActive,
		isOnlineSearchActive,
	}: {
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;

		isThinkingActive?: boolean;
		isOnlineSearchActive?: boolean;
		isMCPActive?: boolean;
	} = body;

	try {
		const openai = createOpenAICompatible({
			name: "302.AI",
			baseURL: baseUrl || "https://api.openai.com/v1",
			apiKey: apiKey || "[REDACTED:sk-secret]",
		});

		const wrapModel = wrapLanguageModel({
			model: openai.chatModel(model),
			middleware: [
				extractReasoningMiddleware({ tagName: "think" }),
				extractReasoningMiddleware({ tagName: "thinking" }),
			],
			providerId: "302.AI",
		});

		const streamTextOptions = {
			model: wrapModel,
			messages: convertToModelMessages(messages),
			abortSignal,
			providerOptions: {
				"302": {
					"r1-fusion": isThinkingActive ?? false,
					"web-search": isOnlineSearchActive ?? false,
					"search-service": "search1api",
				},
			},
			onError: ({ error }: { error: unknown }) => {
				// Show notification here - this is the primary error handler
				ChatErrorHandler.handleError(
					error,
					{
						provider: "302.AI",
						model,
						action: "stream_text",
						retryable: true,
					},
					true,
				);
			},
		};

		addDefinedParams(streamTextOptions, {
			temperature,
			topP,
			maxTokens,
			frequencyPenalty,
			presencePenalty,
		});

		const result = streamText(streamTextOptions);

		return monitorStreamErrors(result, messages, {
			provider: "302.AI",
			model,
		});
	} catch (error) {
		// Only handle initialization/setup errors here (before streaming starts)
		ChatErrorHandler.handleError(
			error,
			{
				provider: "302.AI",
				model,
				action: "initialize_chat",
				retryable: true,
			},
			true,
		);
		throw error;
	}
};

export const openaiHandler: HF = async ({ messages, abortSignal, body }) => {
	const {
		baseUrl,
		model = "gpt-4o",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	}: {
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		isMCPActive?: boolean;
	} = body;

	try {
		const openai = createOpenAI({
			baseURL: baseUrl || "https://api.openai.com/v1",
			apiKey: apiKey || "[REDACTED:sk-secret]",
		});

		const wrapModel = wrapLanguageModel({
			model: openai.chat(model),
			middleware: [
				extractReasoningMiddleware({ tagName: "think" }),
				extractReasoningMiddleware({ tagName: "thinking" }),
			],
		});

		const streamTextOptions = {
			model: wrapModel,
			messages: convertToModelMessages(messages),
			abortSignal,
			onError: ({ error }: { error: unknown }) => {
				// Show notification here - this is the primary error handler
				ChatErrorHandler.handleError(
					error,
					{
						provider: "OpenAI",
						model,
						action: "stream_text",
						retryable: true,
					},
					true,
				);
			},
		};

		addDefinedParams(streamTextOptions, {
			temperature,
			topP,
			maxTokens,
			frequencyPenalty,
			presencePenalty,
		});

		const result = streamText(streamTextOptions);

		return monitorStreamErrors(result, messages, {
			provider: "OpenAI",
			model,
		});
	} catch (error) {
		ChatErrorHandler.handleError(error, {
			provider: "OpenAI",
			model,
			action: "initialize_chat",
			retryable: true,
		});
		throw error;
	}
};

export const anthropicHandler: HF = async ({ messages, abortSignal, body }) => {
	const {
		baseUrl,
		model = "claude-sonnet-4-20250514",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	}: {
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		isMCPActive?: boolean;
	} = body;

	try {
		const anthropic = createAnthropic({
			baseURL: baseUrl || "https://api.anthropic.com/v1",
			apiKey: apiKey || "[REDACTED:sk-secret]",
		});

		const wrapModel = wrapLanguageModel({
			model: anthropic.chat(model),
			middleware: [
				extractReasoningMiddleware({ tagName: "think" }),
				extractReasoningMiddleware({ tagName: "thinking" }),
			],
		});

		const streamTextOptions = {
			model: wrapModel,
			messages: convertToModelMessages(messages),
			abortSignal,
			onError: ({ error }: { error: unknown }) => {
				// Show notification here - this is the primary error handler
				ChatErrorHandler.handleError(
					error,
					{
						provider: "Anthropic",
						model,
						action: "stream_text",
						retryable: true,
					},
					true,
				);
			},
		};

		addDefinedParams(streamTextOptions, {
			temperature,
			topP,
			maxTokens,
			frequencyPenalty,
			presencePenalty,
		});

		const result = streamText(streamTextOptions);

		return monitorStreamErrors(result, messages, {
			provider: "Anthropic",
			model,
		});
	} catch (error) {
		ChatErrorHandler.handleError(error, {
			provider: "Anthropic",
			model,
			action: "initialize_chat",
			retryable: true,
		});
		throw error;
	}
};

export const googleHandler: HF = async ({ messages, abortSignal, body }) => {
	const {
		baseUrl,
		model = "gpt-4o",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	}: {
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		isMCPActive?: boolean;
	} = body;

	try {
		const google = createGoogleGenerativeAI({
			baseURL: baseUrl || "https://generativelanguage.googleapis.com/v1beta",
			apiKey: apiKey || "[REDACTED:sk-secret]",
		});

		const wrapModel = wrapLanguageModel({
			model: google.chat(model),
			middleware: [
				extractReasoningMiddleware({ tagName: "think" }),
				extractReasoningMiddleware({ tagName: "thinking" }),
			],
		});

		const streamTextOptions = {
			model: wrapModel,
			messages: convertToModelMessages(messages),
			abortSignal,
			onError: ({ error }: { error: unknown }) => {
				// Show notification here - this is the primary error handler
				ChatErrorHandler.handleError(
					error,
					{
						provider: "Google",
						model,
						action: "stream_text",
						retryable: true,
					},
					true,
				);
			},
		};

		addDefinedParams(streamTextOptions, {
			temperature,
			topP,
			maxTokens,
			frequencyPenalty,
			presencePenalty,
		});

		const result = streamText(streamTextOptions);

		return monitorStreamErrors(result, messages, {
			provider: "Google",
			model,
		});
	} catch (error) {
		ChatErrorHandler.handleError(error, {
			provider: "Google",
			model,
			action: "initialize_chat",
			retryable: true,
		});
		throw error;
	}
};
