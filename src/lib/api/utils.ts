import { codeAgentState } from "$lib/stores/code-agent";
import type { ModelProvider } from "@shared/types";
import { match } from "ts-pattern";
import { _302AIKy } from "./core/_302ai-ky";
import { createCloudModeKy } from "./core/cloud-mode-ky";
import { createLocalCodeAgentKy } from "./core/local-code-agent-ky";

/**
 * Get the API key for a specific provider
 */
export function getApiKeyByProvider(provider: ModelProvider): string {
	return provider.apiKey;
}

export function getApiKeyByProviderKey(apiKey: string): string {
	return apiKey;
}

/**
 * Get the appropriate ky instance based on code agent mode
 */
export async function getCodeAgentKy() {
	return await match(codeAgentState.type)
		.with("local", () => createLocalCodeAgentKy())
		.with("cloud", () => createCloudModeKy())
		.with("remote", () => _302AIKy)
		.exhaustive();
}
