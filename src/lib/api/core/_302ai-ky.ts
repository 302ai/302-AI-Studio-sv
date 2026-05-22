import { attemptAsync } from "es-toolkit";
import ky from "ky";

const { getUserAgentFragment } = window.electronAPI.appService;
const { get302AIApiKey } = window.electronAPI.providerService;

export const _302AIKy = ky.create({
	timeout: 180000,
	prefixUrl: "https://api.302ai.com",
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
			},
		],
	},
});
