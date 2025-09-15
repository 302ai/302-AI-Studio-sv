import type { Model } from "$lib/types/model.js";
import type { ModelProvider } from "$lib/types/provider.js";
import { parseModelCapabilities } from "$lib/utils/model-capabilities.js";

/**
 * Model API interface functions
 * These functions fetch model lists from different provider APIs based on their configuration
 */

export interface ModelApiResponse<T = unknown> {
	success: boolean;
	data?: T;
	error?: string;
}

export interface ModelListResponse {
	models: Model[];
	total: number;
}

/**
 * Get the models endpoint URL based on provider configuration
 */
function getModelsEndpoint(provider: ModelProvider): string {
	const baseUrl = provider.baseUrl.replace(/\/$/, "");

	switch (provider.apiType.toLowerCase()) {
		case "openai":
		case "302ai":
			if (baseUrl.endsWith("/v1")) {
				return `${baseUrl}/models?llm=1`;
			}
			return `${baseUrl}/v1/models?llm=1`;
		case "anthropic":
			return `${baseUrl}/v1/models`;
		case "gemini":
		case "google":
			return `${baseUrl}/v1beta/models`;
		default:
			if (baseUrl.endsWith("/v1")) {
				return `${baseUrl}/models`;
			}
			return `${baseUrl}/v1/models`;
	}
}

/**
 * Get request headers based on provider configuration
 */
function getRequestHeaders(provider: ModelProvider): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};

	switch (provider.apiType.toLowerCase()) {
		case "openai":
		case "302ai":
		default:
			headers["Authorization"] = `Bearer ${provider.apiKey}`;
			break;
		case "anthropic":
			headers["x-api-key"] = provider.apiKey;
			headers["anthropic-version"] = "2023-06-01";
			break;
		case "gemini":
		case "google":
			break;
	}

	return headers;
}

/**
 * Parse models response based on provider type
 */
function parseModelsResponse(
	provider: ModelProvider,
	data: { data?: { id: string }[]; models?: { name: string }[]; [key: string]: unknown },
): Model[] {
	let modelNames: string[] = [];

	switch (provider.apiType.toLowerCase()) {
		case "openai":
		case "302ai":
		default:
			modelNames = (data.data || []).map((model) => model.id);
			break;

		case "anthropic":
			modelNames = (data.data || []).map((model) => model.id);
			break;

		case "gemini":
		case "google":
			modelNames = (data.models || []).map((model) => model.name.replace("models/", ""));
			break;
	}
	return modelNames.map((modelName) => {
		const capabilities = parseModelCapabilities(modelName);
		return {
			id: modelName,
			name: modelName,
			remark: "",
			providerId: provider.id,
			capabilities,
			type: "language",
			custom: false,
			enabled: true,
			collected: false,
		};
	});
}

/**
 * Get models for a specific provider based on its configuration
 */
export async function getModelsByProvider(
	provider: ModelProvider,
): Promise<ModelApiResponse<ModelListResponse>> {
	try {
		const endpoint = getModelsEndpoint(provider);
		let url = endpoint;
		if (
			provider.apiType.toLowerCase() === "gemini" ||
			provider.apiType.toLowerCase() === "google"
		) {
			url += `?key=${provider.apiKey}`;
		}

		const headers = getRequestHeaders(provider);

		const response = await fetch(url, {
			method: "GET",
			headers,
		});

		if (!response.ok) {
			throw new Error(`API request failed: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		const models = parseModelsResponse(provider, data);

		return {
			success: true,
			data: {
				models,
				total: models.length,
			},
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch models",
		};
	}
}

/**
 * Get all models from all enabled providers
 */
export async function getAllModels(
	providers: ModelProvider[],
): Promise<ModelApiResponse<ModelListResponse>> {
	try {
		const enabledProviders = providers.filter((p) => p.enabled);
		const modelPromises = enabledProviders.map((provider) => getModelsByProvider(provider));

		const results = await Promise.allSettled(modelPromises);
		const allModels: Model[] = [];
		const errors: string[] = [];

		for (const result of results) {
			if (result.status === "fulfilled" && result.value.success && result.value.data) {
				allModels.push(...result.value.data.models);
			} else if (result.status === "fulfilled" && !result.value.success) {
				errors.push(result.value.error || "Unknown error");
			} else if (result.status === "rejected") {
				errors.push(result.reason?.message || "Request failed");
			}
		}

		return {
			success: true,
			data: {
				models: allModels,
				total: allModels.length,
			},
			error: errors.length > 0 ? `Some requests failed: ${errors.join(", ")}` : undefined,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch all models",
		};
	}
}
