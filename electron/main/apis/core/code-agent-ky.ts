import { DEFAULT_SANDBOX_PORT, localVibeService } from "@electron/main/services/local-vibe-service";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import { getProxyAgent } from "@electron/main/utils/proxy-helper";
import ky from "ky";
import { fetch as undiciFetch } from "undici";

const userAgent = getCustomUserAgentFragment();

// Create a custom fetch function that uses proxy for non-localhost requests
async function createFetchWithProxy(
	input: RequestInfo | URL,
	init?: RequestInit,
): Promise<Response> {
	// Extract URL string for hostname check
	let urlString: string;
	if (input instanceof Request) {
		urlString = input.url;
	} else if (input instanceof URL) {
		urlString = input.href;
	} else {
		urlString = input;
	}
	const url = new URL(urlString);

	// Skip proxy for localhost
	if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
		return fetch(input, init);
	}

	const proxyAgent = await getProxyAgent();
	if (proxyAgent) {
		// Convert Request object to URL string for undici compatibility
		let fetchUrl: string;
		let fetchInit = init;

		if (input instanceof Request) {
			fetchUrl = input.url;
			fetchInit = {
				method: input.method,
				headers: input.headers,
				body: input.body,
				...init,
			};
		} else if (input instanceof URL) {
			fetchUrl = input.href;
		} else {
			fetchUrl = input;
		}

		// Use undici fetch with proxy dispatcher
		// Type assertion needed for undici compatibility with standard fetch types

		return undiciFetch(fetchUrl, {
			...fetchInit,
			dispatcher: proxyAgent,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} as any) as unknown as Promise<Response>;
	}
	// Use standard fetch if no proxy
	return fetch(input, init);
}

export const localCodeAgentKy = ky.create({
	timeout: 180000,
	prefixUrl: `http://localhost:${DEFAULT_SANDBOX_PORT}`,
	headers: {
		"User-Agent": userAgent,
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
	fetch: createFetchWithProxy,
	hooks: {
		beforeRequest: [
			async (request) => {
				const runtimePort = localVibeService.getRuntimePort() ?? DEFAULT_SANDBOX_PORT;

				const url = new URL(request.url);
				if (parseInt(url.port) !== runtimePort) {
					url.port = runtimePort.toString();
				}

				return new Request(url.toString(), request);
			},
		],
	},
});
