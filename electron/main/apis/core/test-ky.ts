import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import { getProxyAgent } from "@electron/main/utils/proxy-helper";
import ky from "ky";

const userAgent = getCustomUserAgentFragment();

export const testKy = ky.create({
	timeout: 180000,
	prefixUrl: import.meta.env.VITE_TEST_API_URL ?? "",
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
