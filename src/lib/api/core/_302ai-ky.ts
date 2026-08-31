import { DEFAULT_302AI_BASE_URL, get302AIBaseUrlWithoutV1 } from "@shared/utils/302ai-base-url";
import { attemptAsync } from "es-toolkit";
import ky from "ky";

import { persistedProviderState } from "$lib/stores/provider-state.svelte";

const { getUserAgentFragment } = window.electronAPI.appService;
const { get302AIApiKey } = window.electronAPI.providerService;

/**
 * Factory function to create a 302.AI ky instance with dynamic baseUrl.
 *
 * Reads the baseUrl from persistedProviderState (sync) so the instance always
 * reflects the user's latest provider settings. A factory is required in the
 * renderer because a singleton ky instance can hold stale HTTP/2 connections to
 * the old host, causing ERR_ALPN_NEGOTIATION_FAILED errors when the user changes
 * their baseUrl — the same issue documented in createLocalCodeAgentKy().
 */
export async function create302AIKy() {
	const provider = persistedProviderState.current.find((p) => p.apiType === "302ai");
	const prefixUrl = get302AIBaseUrlWithoutV1(provider?.baseUrl || DEFAULT_302AI_BASE_URL);

	return ky.create({
		timeout: 180000,
		prefixUrl,
		headers: {
			"HTTP-Referer": "https://studio.302.ai/",
			"X-Title": "302.AI Studio",
		},
		retry: 3,
		hooks: {
			beforeRequest: [
				async (request) => {
					const userAgent = await getUserAgentFragment();
					request.headers.set("User-Agent", userAgent);

					const [error, apiKey] = await attemptAsync(get302AIApiKey);

					if (error) {
						throw new Error("302.ai API key validation failed");
					}

					request.headers.set("Authorization", `Bearer ${apiKey}`);
					return request;
				},
			],
		},
	});
}
