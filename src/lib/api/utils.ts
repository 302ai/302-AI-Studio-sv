import { codeAgentState } from "$lib/stores/code-agent";
import type { CodeAgentType, ModelProvider } from "@shared/types";
import { match } from "ts-pattern";
import { create302AIKy } from "./core/_302ai-ky";
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
export async function getCodeAgentKy(mode?: CodeAgentType) {
	const currentMode = mode ?? codeAgentState.type;
	return await match(currentMode)
		.with("local", () => createLocalCodeAgentKy())
		.with("cloud", () => createCloudModeKy())
		.with("remote", () => create302AIKy())
		.exhaustive();
}

export function isLocalOrCloudMode() {
	return ["local", "cloud"].includes(codeAgentState.type);
}
