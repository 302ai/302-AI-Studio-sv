import type { ModelProvider } from "@shared/types";

export function normalizeProviderList(value: unknown): ModelProvider[] {
	let providers: ModelProvider[];

	if (Array.isArray(value)) {
		providers = value.filter(isModelProvider);
	} else if (value && typeof value === "object") {
		providers = Object.values(value).filter(isModelProvider);
	} else {
		return [];
	}

	return providers.map((provider) => {
		if (provider.apiType === "302ai" && provider.baseUrl?.includes("api.302.ai")) {
			return {
				...provider,
				baseUrl: provider.baseUrl.replace("api.302.ai", "api.302ai.com"),
			};
		}

		return provider;
	});
}

function isModelProvider(value: unknown): value is ModelProvider {
	return value !== null && typeof value === "object" && "apiType" in value;
}
