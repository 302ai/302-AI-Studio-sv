/**
 * 302.AI Provider Plugin
 *
 * Provides integration with 302.AI API (Multi-model support)
 */

import type { Model, ModelProvider } from "@302ai/studio-plugin-sdk";
import { BaseProviderPlugin } from "@302ai/studio-plugin-sdk";

/**
 * 302.AI model response interface (OpenAI-compatible)
 */
interface AI302Model {
	id: string;
	object: string;
	created: number;
	owned_by: string;
}

interface AI302ModelsResponse {
	object: string;
	data: AI302Model[];
}

/**
 * 302.AI Provider Plugin Implementation
 */
export class AI302ProviderPlugin extends BaseProviderPlugin {
	protected providerId = "302AI";
	protected providerName = "302.AI";
	protected apiType = "302ai";
	protected defaultBaseUrl = "https://api.302.ai/v1";

	protected websites = {
		official: "https://302.ai/",
		apiKey: "https://dash.302.ai/apis/list",
		docs: "https://302ai.apifox.cn/",
		models: "https://302ai.apifox.cn/api-147522038",
	};

	/**
	 * Get authentication headers for 302.AI API
	 * Uses OpenAI-compatible authorization
	 */
	protected getAuthHeaders(provider: ModelProvider): Record<string, string> {
		return {
			Authorization: `Bearer ${provider.apiKey}`,
		};
	}

	/**
	 * Fetch models from 302.AI API
	 */
	async onFetchModels(provider: ModelProvider): Promise<Model[]> {
		const url = this.buildApiUrl(provider, "models?llm=1");

		try {
			const response = (await this.httpRequest(url, {
				method: "GET",
				provider,
			})) as AI302ModelsResponse;

			return response.data
				.filter(
					(model: AI302Model) =>
						// Filter for language models (exclude embeddings, etc.)
						!model.id.includes("embedding") &&
						!model.id.includes("whisper") &&
						!model.id.includes("tts") &&
						!model.id.includes("dall-e"),
				)
				.map((model: AI302Model) => ({
					id: model.id,
					name: model.id,
					remark: `302.AI ${model.id}`,
					providerId: this.providerId,
					capabilities: this.parseModelCapabilities(model.id),
					type: this.parseModelType(model.id),
					custom: false,
					enabled: true,
					collected: false,
				}));
		} catch (error) {
			this.log("error", "Failed to fetch 302.AI models:", error);
			throw error;
		}
	}

	/**
	 * Parse model capabilities from model ID
	 * 302.AI supports various models with different capabilities
	 */
	protected parseModelCapabilities(modelId: string): Set<string> {
		const capabilities = new Set<string>();

		// Vision support
		if (
			modelId.includes("vision") ||
			modelId.includes("gpt-4") ||
			modelId.includes("gpt-4o") ||
			modelId.includes("claude") ||
			modelId.includes("gemini")
		) {
			capabilities.add("vision");
		}

		// Function calling support
		if (
			modelId.includes("gpt-4") ||
			modelId.includes("gpt-3.5") ||
			modelId.includes("claude") ||
			modelId.includes("gemini")
		) {
			capabilities.add("function_call");
		}

		// Reasoning support (for o1, o3 models)
		if (modelId.includes("o1") || modelId.includes("o3")) {
			capabilities.add("reasoning");
		}

		return capabilities;
	}

	/**
	 * Parse model type from model ID
	 */
	protected parseModelType(
		modelId: string,
	): "language" | "image-generation" | "tts" | "embedding" | "rerank" {
		if (modelId.includes("dall-e") || modelId.includes("stable-diffusion")) {
			return "image-generation";
		}

		if (modelId.includes("tts")) {
			return "tts";
		}

		if (modelId.includes("embedding")) {
			return "embedding";
		}

		// Default to language model
		return "language";
	}

	/**
	 * Test connection to 302.AI API
	 */
	protected async testConnection(provider: ModelProvider): Promise<void> {
		this.log("info", "Testing 302.AI API connection...");

		try {
			// Try to fetch models to verify API key
			const url = this.buildApiUrl(provider, "models?llm=1");
			await this.httpRequest(url, {
				method: "GET",
				provider,
			});

			this.log("info", "302.AI API connection successful");
		} catch (error) {
			this.log("error", "302.AI API connection failed:", error);

			if (error instanceof Error) {
				if (error.message.includes("401")) {
					throw new Error("Invalid API key. Please check your 302.AI API key and try again.");
				}
				if (error.message.includes("403")) {
					throw new Error("Access forbidden. Your API key may not have the required permissions.");
				}
				if (error.message.includes("429")) {
					throw new Error("Rate limit exceeded. Please try again later.");
				}
			}

			throw new Error(
				`Connection test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}
}

// Also export as default for compatibility
export default AI302ProviderPlugin;
