import ky from "ky";

const { getUserAgentFragment } = window.electronAPI.appService;
const { get302AIApiKey } = window.electronAPI.providerService;

/**
 * Ky instance for the Aliyun Compute Gateway API.
 * Uses the same 302.AI API key for auth.
 */
export const cloudModeKy = ky.create({
	timeout: 60000,
	prefixUrl: "http://192.168.199.37:8001/api/v1",
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

				try {
					const apiKey = await get302AIApiKey();
					request.headers.set("Authorization", `Bearer ${apiKey}`);
				} catch {
					throw new Error("302.ai API key validation failed");
				}
			},
		],
	},
});
