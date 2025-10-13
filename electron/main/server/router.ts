import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { serve } from "@hono/node-server";
import {
	convertToModelMessages,
	extractReasoningMiddleware,
	streamText,
	wrapLanguageModel,
	type UIMessage,
} from "ai";
import { Hono } from "hono";
import getPort from "get-port";

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

const app = new Hono();

app.post("/chat/302ai", async (c) => {
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
		messages,
	} = await c.req.json<{
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

		messages: UIMessage[];
	}>();
	console.log(
		baseUrl,
		model,
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isThinkingActive,
		isOnlineSearchActive,
		messages,
	);

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

	return result.toUIMessageStreamResponse({
		messageMetadata: () => ({
			model,
			provider: "ai302",
			createdAt: new Date().toISOString(),
		}),
	});
});

app.post("/chat/openai", async (c) => {
	const {
		baseUrl,
		model = "gpt-4o",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		messages,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		messages: UIMessage[];
	}>();

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
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = streamText(streamTextOptions);

	return result.toUIMessageStreamResponse({
		messageMetadata: () => ({
			model,
			provider: "openai",
			createdAt: new Date().toISOString(),
		}),
	});
});

app.post("/chat/anthropic", async (c) => {
	const {
		baseUrl,
		model = "claude-sonnet-4-20250514",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		messages,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		messages: UIMessage[];
	}>();

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
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = streamText(streamTextOptions);

	return result.toUIMessageStreamResponse({
		messageMetadata: () => ({
			model,
			provider: "anthropic",
			createdAt: new Date().toISOString(),
		}),
	});
});

app.post("/chat/gemini", async (c) => {
	const {
		baseUrl,
		model = "gemini-2.0-flash-exp",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		messages,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		messages: UIMessage[];
	}>();

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
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const result = streamText(streamTextOptions);

	return result.toUIMessageStreamResponse({
		messageMetadata: () => ({
			model,
			provider: "gemini",
			createdAt: new Date().toISOString(),
		}),
	});
});

export async function initServer(preferredPort = 8089): Promise<number> {
	const port = await getPort({ port: preferredPort });

	serve({
		fetch: app.fetch,
		port,
		hostname: "localhost",
	});

	console.log(`Server started successfully on port ${port}`);
	return port;
}
