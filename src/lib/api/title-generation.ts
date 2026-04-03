import type { ChatMessage } from "$lib/types/chat";
import type { ModelProvider } from "@shared/storage/provider";
import type { Model } from "@shared/types";
import { normalizeGeneratedTitleResult } from "@shared/utils/title-generation";
import { withGenerationFallback, type FallbackModelConfig } from "./generation-fallback";

export type { FallbackModelConfig } from "./generation-fallback";

export interface GenerateTitleRequest {
	messages: ChatMessage[];
	model: string;
	apiKey?: string;
	baseUrl?: string;
	providerType: "302ai" | "openai" | "anthropic" | "gemini";
	previousSummary?: string;
	isFirstGeneration?: boolean;
}

export interface GenerateTitleResponse {
	title: string;
	summary: string;
}

export interface GenerateTitleResult {
	title: string;
	summary: string;
}

async function generateTitleRequest(
	messages: ChatMessage[],
	modelId: string,
	provider: ModelProvider | undefined,
	serverPort: number,
	previousSummary?: string,
	isFirstGeneration?: boolean,
	signal?: AbortSignal,
): Promise<GenerateTitleResult> {
	const response = await fetch(`http://localhost:${serverPort}/generate-title`, {
		signal,
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
			previousSummary,
			isFirstGeneration,
		} satisfies GenerateTitleRequest),
	});

	if (!response.ok) {
		throw new Error(`Failed to generate title: ${response.statusText}`);
	}

	const data: GenerateTitleResponse = await response.json();
	return normalizeGeneratedTitleResult(data);
}

export async function generateTitle(
	messages: ChatMessage[],
	model: Model,
	provider: ModelProvider | undefined,
	serverPort?: number,
	previousSummary?: string,
	isFirstGeneration?: boolean,
	fallbackConfig?: FallbackModelConfig,
	signal?: AbortSignal,
): Promise<GenerateTitleResult | null> {
	const port = serverPort ?? 8089;

	return await withGenerationFallback({
		operation: "title generation",
		model,
		provider,
		fallbackConfig,
		signal,
		request: (modelId, selectedProvider) =>
			generateTitleRequest(
				messages,
				modelId,
				selectedProvider,
				port,
				previousSummary,
				isFirstGeneration,
				signal,
			),
	});
}
