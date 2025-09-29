import type { HF } from "$lib/transport/f-chat-transport";
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
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = streamText(streamTextOptions);

	return result.toUIMessageStream({
		originalMessages: messages,
		messageMetadata: () => ({ model: model, createdAt: new Date().toISOString() }),
	});
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
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = streamText(streamTextOptions);

	return result.toUIMessageStream({
		originalMessages: messages,
		messageMetadata: () => ({ model: model, createdAt: new Date().toISOString() }),
	});
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
	const openai = createAnthropic({
		baseURL: baseUrl || "https://api.anthropic.com/v1",
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
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = streamText(streamTextOptions);

	return result.toUIMessageStream({
		originalMessages: messages,
		messageMetadata: () => ({ model: model, createdAt: new Date().toISOString() }),
	});
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
	const openai = createGoogleGenerativeAI({
		baseURL: baseUrl || "https://generativelanguage.googleapis.com/v1beta",
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
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = streamText(streamTextOptions);

	return result.toUIMessageStream({
		originalMessages: messages,
		messageMetadata: () => ({ model: model, createdAt: new Date().toISOString() }),
	});
};
