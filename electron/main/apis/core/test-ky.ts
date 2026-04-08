import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import ky from "ky";

const userAgent = getCustomUserAgentFragment();

export const testKy = ky.create({
	timeout: 60000,
	prefixUrl: "http://192.168.199.116:8001",
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
