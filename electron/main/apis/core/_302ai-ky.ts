import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import ky from "ky";

const userAgent = getCustomUserAgentFragment();

export const _302AIKy = ky.create({
	timeout: 180000,
	prefixUrl: "https://api.302.ai",
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
			},
		],
	},
});
