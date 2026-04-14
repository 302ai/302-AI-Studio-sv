import type { ChatMessage } from "$lib/types/chat";
import { createLogger } from "@shared/logger";
import type { ModelProvider } from "@shared/storage/provider";
import type { Model } from "@shared/types";
import { withGenerationFallback, type FallbackModelConfig } from "./generation-fallback";

const logger = createLogger("apis");

export interface GenerateSuggestionsRequest {
	messages: ChatMessage[];
	model: string;
	apiKey?: string;
	baseUrl?: string;
	providerType: "302ai" | "openai" | "anthropic" | "gemini";
	language?: string;
	count?: number;
}

export interface GenerateSuggestionsResponse {
	suggestions: string[];
}

async function generateSuggestionsRequest(
	messages: ChatMessage[],
	modelId: string,
	provider: ModelProvider | undefined,
	serverPort: number,
	language?: string,
	count?: number,
	signal?: AbortSignal,
): Promise<string[]> {
	const response = await fetch(`http://localhost:${serverPort}/generate-suggestions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			messages,
			model: modelId,
			apiKey: provider?.apiKey,
			baseUrl: provider?.baseUrl,
			providerType: provider?.apiType || "openai",
			language,
			count: count ?? 3,
		} satisfies GenerateSuggestionsRequest),
		signal,
	});

	if (!response.ok) {
		throw new Error(`Failed to generate suggestions: ${response.statusText}`);
	}

	const data: GenerateSuggestionsResponse = await response.json();
	return data.suggestions;
}

export async function generateSuggestions(
	messages: ChatMessage[],
	model: Model,
	provider: ModelProvider | undefined,
	language?: string,
	count?: number,
	serverPort?: number,
	fallbackConfig?: FallbackModelConfig,
	signal?: AbortSignal,
): Promise<string[]> {
	const port = serverPort ?? 8089;

	try {
		logger.debug("[Suggestions] Starting async generation...");
		const suggestions = await withGenerationFallback({
			operation: "suggestions generation",
			model,
			provider,
			fallbackConfig,
			signal,
			request: (modelId, selectedProvider) =>
				generateSuggestionsRequest(
					messages,
					modelId,
					selectedProvider,
					port,
					language,
					count,
					signal,
				),
		});

		if (!suggestions || suggestions.length === 0) {
			return [];
		}

		logger.debug("[Suggestions] Received suggestions:", suggestions);
		return suggestions;
	} catch (error) {
		// Don't log abort errors as they are expected when user sends a new message
		if (error instanceof DOMException && error.name === "AbortError") {
			logger.info("[Suggestions] Generation aborted");
			return [];
		}
		logger.error("[Suggestions] Generation failed:", error);
		return [];
	}
}
