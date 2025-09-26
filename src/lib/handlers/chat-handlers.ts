import type { HF } from "$lib/transport/f-chat-transport";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";

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
	const openai = createOpenAI({
		baseURL: baseUrl,
		apiKey: apiKey || "[REDACTED:sk-secret]",
	});

	const result = streamText({
		model: openai.chat(model),
		messages: convertToModelMessages(messages),
		abortSignal,
		temperature,
		topP,
		maxOutputTokens: maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	return result.toUIMessageStream();
};
