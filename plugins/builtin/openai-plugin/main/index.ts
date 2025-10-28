/**
 * OpenAI Provider Plugin
 *
 * Provides integration with OpenAI API (GPT models)
 */

import type { Model, ModelProvider } from "@302ai/studio-plugin-sdk";
import { BaseProviderPlugin } from "@302ai/studio-plugin-sdk";

/**
 * OpenAI model response interface
 */
interface OpenAIModel {
	id: string;
	object: string;
	created: number;
	owned_by: string;
}

interface OpenAIModelsResponse {
	data: OpenAIModel[];
	object: string;
}

/**
 * OpenAI Provider Plugin
 */
export class OpenAIProviderPlugin extends BaseProviderPlugin {
	protected providerId = "openai";
	protected providerName = "OpenAI";
	protected apiType = "openai";
	protected defaultBaseUrl = "https://api.openai.com/v1";

	protected websites = {
		official: "https://openai.com/",
		apiKey: "https://platform.openai.com/api-keys",
		docs: "https://platform.openai.com/docs",
		models: "https://platform.openai.com/docs/models",
	};

	/**
	 * Get authentication headers
	 * OpenAI uses Bearer token + optional Organization header
	 */
	protected getAuthHeaders(provider: ModelProvider): Record<string, string> {
		const headers: Record<string, string> = {
			Authorization: `Bearer ${provider.apiKey}`,
		};

		// Organization header will be added if configured in plugin settings
		// This is handled synchronously to avoid async issues in getAuthHeaders

		return headers;
	}

	/**
	 * Fetch models from OpenAI API
	 */
	async onFetchModels(provider: ModelProvider): Promise<Model[]> {
		this.log("info", "Fetching models from OpenAI API...");

		try {
			const url = this.buildApiUrl(provider, "models?llm=1");

			const response = (await this.httpRequest(url, {
				method: "GET",
				provider,
			})) as OpenAIModelsResponse;

			// Filter and map models
			const models: Model[] = response.data
				.filter((model: OpenAIModel) => {
					// Only include chat/language models
					const modelId = model.id.toLowerCase();
					return (
						modelId.includes("gpt") ||
						modelId.includes("o1") ||
						modelId.includes("o3") ||
						modelId.includes("chatgpt")
					);
				})
				.map((model: OpenAIModel) => ({
					id: model.id,
					name: model.id,
					remark: `OpenAI ${model.id}`,
					providerId: this.providerId,
					capabilities: this.parseModelCapabilities(model.id),
					type: this.parseModelType(model.id),
					custom: false,
					enabled: true,
					collected: false,
				}));

			this.log("info", `Fetched ${models.length} models from OpenAI`);
			return models;
		} catch (error) {
			this.log("error", "Failed to fetch OpenAI models:", error);
			throw new Error(
				`Failed to fetch models: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Parse model capabilities for OpenAI models
	 */
	protected parseModelCapabilities(modelId: string): Set<string> {
		const capabilities = new Set<string>();

		// Vision support
		if (
			modelId.includes("gpt-4-turbo") ||
			modelId.includes("gpt-4o") ||
			modelId.includes("gpt-4-vision")
		) {
			capabilities.add("vision");
		}

		// Function calling support
		if (
			modelId.includes("gpt-4") ||
			modelId.includes("gpt-3.5-turbo") ||
			modelId.includes("o1") ||
			modelId.includes("o3")
		) {
			capabilities.add("functionCall");
		}

		// Reasoning models
		if (modelId.includes("o1") || modelId.includes("o3")) {
			capabilities.add("reasoning");
		}

		return capabilities;
	}

	/**
	 * Test connection to OpenAI API
	 */
	protected async testConnection(provider: ModelProvider): Promise<void> {
		this.log("info", "Testing OpenAI API connection...");

		try {
			// Try to fetch models to verify API key
			const url = this.buildApiUrl(provider, "models");
			await this.httpRequest(url, {
				method: "GET",
				provider,
			});

			this.log("info", "OpenAI API connection successful");
		} catch (error) {
			this.log("error", "OpenAI API connection failed:", error);

			if (error instanceof Error) {
				if (error.message.includes("401")) {
					throw new Error("Invalid API key. Please check your OpenAI API key and try again.");
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
export default OpenAIProviderPlugin;
