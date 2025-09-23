import type { HF } from "$lib/transport/f-chat-transport";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";

export const openaiHandler: HF = async ({ messages, abortSignal }) => {
	const openai = createOpenAI({
		baseURL: "https://api.302.ai/v1",
		apiKey: "sk-xEvdXHlpXaC2SGqVGRY9IrjoH0IanxMil3F25jKHojG7yALo",
	});

	const result = streamText({
		model: openai("gpt-4o"),
		messages: convertToModelMessages(messages),
		abortSignal,
	});

	console.log("dsadasdas");

	return result.toUIMessageStream();
};
