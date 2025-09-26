import type { HF } from "$lib/transport/f-chat-transport";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
	convertToModelMessages,
	extractReasoningMiddleware,
	streamText,
	wrapLanguageModel,
} from "ai";

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
	});

	const result = streamText({
		model: wrapModel,
		messages: convertToModelMessages(messages),
		abortSignal,
		temperature,
		topP,
		maxOutputTokens: maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	return result.toUIMessageStream({
		originalMessages: messages,
		messageMetadata: () => ({ model: model, createdAt: new Date().toISOString() }),
	});
};
