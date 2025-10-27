/**
 * Google AI Provider Plugin
 *
 * Provides integration with Google AI API (Gemini models)
 */

import type { Model, ModelProvider } from "../../../../src/shared/types";
import { BaseProviderPlugin } from "../../../../src/lib/plugin-system/base-provider-plugin";

/**
 * Google AI model response interface
 */
interface GoogleModel {
	name: string;
	baseModelId: string;
	version: string;
	displayName: string;
	description: string;
	inputTokenLimit: number;
	outputTokenLimit: number;
	supportedGenerationMethods: string[];
	temperature?: number;
	topP?: number;
	topK?: number;
}

interface GoogleModelsResponse {
	models: GoogleModel[];
	nextPageToken?: string;
}

/**
 * Google AI Provider Plugin Implementation
 */
export class GoogleProviderPlugin extends BaseProviderPlugin {
	protected providerId = "google";
	protected providerName = "Google AI";
	protected apiType = "gemini";
	protected defaultBaseUrl = "https://generativelanguage.googleapis.com";

	protected websites = {
		official: "https://gemini.google.com/",
		apiKey: "https://aistudio.google.com/app/apikey",
		docs: "https://ai.google.dev/gemini-api/docs",
		models: "https://ai.google.dev/gemini-api/docs/models/gemini",
	};

	/**
	 * Get authentication headers for Google AI API
	 * Google AI uses API key in query parameter, not in headers
	 */
	protected getAuthHeaders(_provider: ModelProvider): Record<string, string> {
		return {};
	}

	/**
	 * Build API URL with Google AI specific formatting
	 * Google AI requires API key as query parameter
	 */
	protected buildApiUrl(provider: ModelProvider, endpoint: string): string {
		const baseUrl = provider.baseUrl.replace(/\/$/, "");
		const fullUrl = endpoint.startsWith("http")
			? endpoint
			: `${baseUrl}/${endpoint.replace(/^\//, "")}`;

		// Add API key as query parameter
		const url = new URL(fullUrl);
		url.searchParams.set("key", provider.apiKey);

		return url.toString();
	}

	/**
	 * Fetch models from Google AI API
	 */
	async onFetchModels(provider: ModelProvider): Promise<Model[]> {
		const url = this.buildApiUrl(provider, "v1beta/models");

		try {
			const response = (await this.httpRequest(url, {
				method: "GET",
				provider,
				// Override auth headers to avoid adding Authorization header
				headers: {},
			})) as GoogleModelsResponse;

			return response.models
				.filter(
					(model) =>
						// Only include Gemini models with generateContent support
						model.name.includes("gemini") &&
						model.supportedGenerationMethods.includes("generateContent"),
				)
				.map((model: GoogleModel) => {
					// Remove "models/" prefix from name
					const modelId = model.name.replace("models/", "");

					return {
						id: modelId,
						name: model.displayName || modelId,
						remark: `Google ${model.displayName || modelId}`,
						providerId: this.providerId,
						capabilities: this.parseModelCapabilities(modelId),
						type: this.parseModelType(modelId),
						custom: false,
						enabled: true,
						collected: false,
					};
				});
		} catch (error) {
			this.log("error", "Failed to fetch Google AI models:", error);
			throw error;
		}
	}

	/**
	 * Parse model capabilities from model ID
	 */
	protected parseModelCapabilities(modelId: string): Set<string> {
		const capabilities = new Set<string>();

		// Gemini Pro Vision and newer models support vision
		if (
			modelId.includes("vision") ||
			modelId.includes("gemini-1.5") ||
			modelId.includes("gemini-2")
		) {
			capabilities.add("vision");
		}

		// Gemini 1.5 and later support function calling
		if (modelId.includes("gemini-1.5") || modelId.includes("gemini-2")) {
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
		// Check if it's an embedding model
		if (_modelId.includes("embedding")) {
			return "embedding";
		}

		// Default to language model
		return "language";
	}

	/**
	 * Test connection to Google AI API
	 */
	protected async testConnection(provider: ModelProvider): Promise<void> {
		this.log("info", "Testing Google AI API connection...");

		try {
			// Try to fetch models to verify API key
			const url = this.buildApiUrl(provider, "v1beta/models");
			await this.httpRequest(url, {
				method: "GET",
				provider,
				headers: {},
			});

			this.log("info", "Google AI API connection successful");
		} catch (error) {
			this.log("error", "Google AI API connection failed:", error);

			if (error instanceof Error) {
				if (error.message.includes("401") || error.message.includes("403")) {
					throw new Error("Invalid API key. Please check your Google AI API key and try again.");
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

	/**
	 * Override httpRequest to handle Google AI specific auth
	 */
	protected async httpRequest<T>(
		url: string,
		options: {
			method?: "GET" | "POST" | "PUT" | "DELETE";
			headers?: Record<string, string>;
			body?: unknown;
			provider: ModelProvider;
		},
	): Promise<T> {
		// For Google AI, don't add authorization headers
		// API key is already in the URL
		const headers = {
			"Content-Type": "application/json",
			...(options.headers || {}),
		};

		const fetchOptions: RequestInit = {
			method: options.method || "GET",
			headers,
		};

		if (options.body) {
			fetchOptions.body = JSON.stringify(options.body);
		}

		if (this.api?.http) {
			return this.api.http.request<T>({
				url,
				method: options.method || "GET",
				headers,
				body: options.body,
			});
		}

		// Fallback to native fetch
		const response = await fetch(url, fetchOptions);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		return response.json() as Promise<T>;
	}
}

// Also export as default for compatibility
export default GoogleProviderPlugin;
