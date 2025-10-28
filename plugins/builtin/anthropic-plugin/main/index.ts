/**
 * Anthropic Provider Plugin
 *
 * Provides integration with Anthropic API (Claude models)
 */

import type { Model, ModelProvider } from "@302ai/studio-plugin-sdk";
import { BaseProviderPlugin } from "@302ai/studio-plugin-sdk";

/**
 * Anthropic model response interface
 */
interface AnthropicModel {
	id: string;
	type: string;
	display_name: string;
	created_at: string;
}

interface AnthropicModelsResponse {
	data: AnthropicModel[];
	has_more: boolean;
	first_id: string;
	last_id: string;
}

/**
 * Anthropic Provider Plugin Implementation
 */
export class AnthropicProviderPlugin extends BaseProviderPlugin {
	protected providerId = "anthropic";
	protected providerName = "Anthropic";
	protected apiType = "anthropic";
	protected defaultBaseUrl = "https://api.anthropic.com";

	protected websites = {
		official: "https://www.anthropic.com/",
		apiKey: "https://console.anthropic.com/settings/keys",
		docs: "https://docs.anthropic.com/",
		models: "https://docs.anthropic.com/claude/docs/models-overview",
	};

	/**
	 * Get authentication headers for Anthropic API
	 */
	protected getAuthHeaders(provider: ModelProvider): Record<string, string> {
		return {
			"x-api-key": provider.apiKey,
			"anthropic-version": "2023-06-01",
		};
	}

	/**
	 * Fetch models from Anthropic API
	 */
	async onFetchModels(provider: ModelProvider): Promise<Model[]> {
		const url = this.buildApiUrl(provider, "v1/models");

		try {
			const response = (await this.httpRequest(url, {
				method: "GET",
				provider,
			})) as AnthropicModelsResponse;

			return response.data.map((model: AnthropicModel) => ({
				id: model.id,
				name: model.display_name || model.id,
				remark: `Anthropic ${model.display_name || model.id}`,
				providerId: this.providerId,
				capabilities: this.parseModelCapabilities(model.id),
				type: this.parseModelType(model.id),
				custom: false,
				enabled: true,
				collected: false,
			}));
		} catch (error) {
			this.log("error", "Failed to fetch Anthropic models:", error);
			throw error;
		}
	}

	/**
	 * Parse model capabilities from model ID
	 */
	protected parseModelCapabilities(modelId: string): Set<string> {
		const capabilities = new Set<string>();

		// All Claude models support vision
		if (modelId.includes("claude")) {
			capabilities.add("vision");
		}

		// Claude 3 Opus and later support function calling
		if (
			modelId.includes("claude-3") ||
			modelId.includes("claude-3.5") ||
			modelId.includes("opus") ||
			modelId.includes("sonnet")
		) {
			capabilities.add("function_call");
		}

		return capabilities;
	}

	/**
	 * Parse model type from model ID
	 */
	protected parseModelType(
		_modelId: string,
	): "language" | "image-generation" | "tts" | "embedding" | "rerank" {
		// Anthropic only has language models
		return "language";
	}

	/**
	 * Test connection to Anthropic API
	 */
	protected async testConnection(provider: ModelProvider): Promise<void> {
		this.log("info", "Testing Anthropic API connection...");

		try {
			// Try to fetch models to verify API key
			const url = this.buildApiUrl(provider, "v1/models");
			await this.httpRequest(url, {
				method: "GET",
				provider,
			});

			this.log("info", "Anthropic API connection successful");
		} catch (error) {
			this.log("error", "Anthropic API connection failed:", error);

			if (error instanceof Error) {
				if (error.message.includes("401")) {
					throw new Error("Invalid API key. Please check your Anthropic API key and try again.");
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
export default AnthropicProviderPlugin;
