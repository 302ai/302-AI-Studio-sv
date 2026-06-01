import { cloudModeService } from "@electron/main/services";
import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import { getProxyAgent } from "@electron/main/utils/proxy-helper";
import ky from "ky";
import { fetch as undiciFetch } from "undici";

const userAgent = getCustomUserAgentFragment();

// Create a custom fetch function that uses proxy
async function createFetchWithProxy(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	const proxyAgent = await getProxyAgent();
	if (proxyAgent) {
		// Convert Request object to URL string for undici compatibility
		let url: string;
		let fetchInit = init;

		if (input instanceof Request) {
			// Extract URL from Request object
			url = input.url;
			// Merge Request's properties with provided init
			fetchInit = {
				method: input.method,
				headers: input.headers,
				body: input.body,
				...init,
			};
		} else if (input instanceof URL) {
			url = input.href;
		} else {
			url = input;
		}

		// Use undici fetch with proxy dispatcher
		// Type assertion needed for undici compatibility with standard fetch types

		return undiciFetch(url, {
			...fetchInit,
			dispatcher: proxyAgent,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any) as unknown as Promise<Response>;
	}
	// Use standard fetch if no proxy
	return fetch(input, init);
}

export const cloudModeKy = ky.create({
	timeout: 180000,
	prefixUrl: "http://placeholder:3000",
	headers: {
		"User-Agent": userAgent,
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
	fetch: createFetchWithProxy,
	hooks: {
		beforeRequest: [
			async (request) => {
				const [providerResult, baseUrlResult] = await Promise.all([
					providerStorage.validate302AIProvider(),
					cloudModeService.getCloudModeInstanceBaseUrl(),
				]);

				const { valid, apiKey } = providerResult;
				if (!valid) throw new Error("302.ai API key validation failed");
				request.headers.set("Authorization", `Bearer ${apiKey}`);

				const { baseUrl } = baseUrlResult;
				const base = new URL(baseUrl);
				const url = new URL(request.url);
				url.protocol = base.protocol;
				url.hostname = base.hostname;
				url.port = base.port;

				return new Request(url.toString(), request);
			},
		],
	},
});
