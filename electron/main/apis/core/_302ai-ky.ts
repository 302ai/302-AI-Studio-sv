import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import { getProxyAgent } from "@electron/main/utils/proxy-helper";
import ky from "ky";

const userAgent = getCustomUserAgentFragment();

export const _302AIKy = ky.create({
	timeout: 180000,
	prefixUrl: "https://api.302ai.com",
	headers: {
		"User-Agent": userAgent,
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
	retry: 3,
	hooks: {
		beforeRequest: [
			async (request) => {
				const { valid, apiKey } = await providerStorage.validate302AIProvider();
				if (!valid) throw new Error("302.ai API key validation failed");
				request.headers.set("Authorization", `Bearer ${apiKey}`);

				const baseUrl = await providerStorage.get302AIBaseUrlWithoutV1();
				const base = new URL(baseUrl);
				const url = new URL(request.url);
				url.protocol = base.protocol;
				url.hostname = base.hostname;
				url.port = base.port;

				// Add proxy support
				const proxyAgent = await getProxyAgent();
				if (proxyAgent) {
					// @ts-expect-error - dispatcher is a valid option for undici fetch
					request.dispatcher = proxyAgent;
				}

				return new Request(url.toString(), request);
			},
		],
	},
});

/**
 * Create a 302.AI ky instance with a specific API key
 * @param apiKey - The API key to use for requests
 * @returns A ky instance configured with the provided API key
 */
export function create302AIKy(apiKey: string, baseUrl = "https://api.302ai.com") {
	return ky.create({
		timeout: 180000,
		prefixUrl: baseUrl.replace(/\/v1\/?$/, ""),
		headers: {
			"User-Agent": userAgent,
			"HTTP-Referer": "https://studio.302.ai/",
			"X-Title": "302.AI Studio",
			Authorization: `Bearer ${apiKey}`,
		},
		retry: 3,
		hooks: {
			beforeRequest: [
				async (request) => {
					// Add proxy support
					const proxyAgent = await getProxyAgent();
					if (proxyAgent) {
						// @ts-expect-error - dispatcher is a valid option for undici fetch
						request.dispatcher = proxyAgent;
					}
					return request;
				},
			],
		},
	});
}
