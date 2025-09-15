export interface ModelProviderWebsites {
	official: string;
	apiKey: string;
	docs: string;
	models: string;
	defaultBaseUrl: string;
}

export type ModelProviderStatus = "pending" | "connected" | "error" | "disabled";

export interface ModelProvider {
	id: string;
	name: string;
	apiType: string;
	apiKey: string;
	baseUrl: string;
	enabled: boolean;
	custom?: boolean;
	status: ModelProviderStatus;
	websites: ModelProviderWebsites;
	icon?: string;
}
