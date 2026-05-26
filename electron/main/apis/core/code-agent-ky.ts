import { DEFAULT_SANDBOX_PORT, localVibeService } from "@electron/main/services/local-vibe-service";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import { getProxyAgent } from "@electron/main/utils/proxy-helper";
import ky from "ky";

const userAgent = getCustomUserAgentFragment();

export const localCodeAgentKy = ky.create({
	timeout: 180000,
	prefixUrl: `http://localhost:${DEFAULT_SANDBOX_PORT}`,
	headers: {
		"User-Agent": userAgent,
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
	hooks: {
		beforeRequest: [
			async (request) => {
				const runtimePort = localVibeService.getRuntimePort() ?? DEFAULT_SANDBOX_PORT;

				const url = new URL(request.url);
				if (parseInt(url.port) !== runtimePort) {
					url.port = runtimePort.toString();
				}

				// Add proxy support (but skip for localhost requests)
				if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
					const proxyAgent = await getProxyAgent();
					if (proxyAgent) {
						// @ts-expect-error - dispatcher is a valid option for undici fetch
						request.dispatcher = proxyAgent;
					}
				}

				return new Request(url.toString(), request);
			},
		],
	},
});
