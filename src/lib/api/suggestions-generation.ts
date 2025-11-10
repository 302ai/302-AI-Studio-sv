import type { ChatMessage } from "$lib/types/chat";
import type { ModelProvider } from "@shared/storage/provider";
import type { Model } from "@shared/types";

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

export async function generateSuggestions(
	messages: ChatMessage[],
	model: Model,
	provider: ModelProvider | undefined,
	language?: string,
	count?: number,
	serverPort?: number,
): Promise<string[]> {
	const port = serverPort ?? 8089;

	try {
		console.log("[Suggestions] Starting async generation...");
		const response = await fetch(`http://localhost:${port}/generate-suggestions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages,
				model: model.id,
				apiKey: provider?.apiKey,
				baseUrl: provider?.baseUrl,
				providerType: provider?.apiType || "openai",
				language,
				count: count ?? 3,
			} satisfies GenerateSuggestionsRequest),
		});

		if (!response.ok) {
			console.error("[Suggestions] Failed to generate:", response.statusText);
			return [];
		}

		const data: GenerateSuggestionsResponse = await response.json();
		console.log("[Suggestions] Received suggestions:", data.suggestions);
		return data.suggestions;
	} catch (error) {
		console.error("[Suggestions] Generation failed:", error);
		return [];
	}
}
