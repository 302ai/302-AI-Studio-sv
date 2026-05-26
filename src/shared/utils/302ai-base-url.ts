export const DEFAULT_302AI_BASE_URL = "https://api.302ai.com/v1";

export function get302AIBaseUrlWithoutV1(baseUrl: string): string {
	return baseUrl.replace(/\/v1\/?$/, "");
}
