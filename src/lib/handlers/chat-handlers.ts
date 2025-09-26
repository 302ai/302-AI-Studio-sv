import type { HF } from "$lib/transport/f-chat-transport";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";

export const openaiHandler: HF = async ({ messages, abortSignal, body }) => {
	const {
		model = "gpt-4o",
		apiKey,
	}: {
		model?: string;
		apiKey?: string;
	} = body;
	console.log(model, apiKey);
	const openai = createOpenAI({
		baseURL: "https://api.302.ai/v1",
		apiKey: apiKey || "[REDACTED:sk-secret]",
	});

	const result = streamText({
		model: openai.chat(model),
		messages: convertToModelMessages(messages),
		abortSignal,
	});

	console.log("dsadasdas");

	return result.toUIMessageStream();
};
