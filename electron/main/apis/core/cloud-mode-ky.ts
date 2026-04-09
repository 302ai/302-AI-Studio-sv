import { cloudModeService } from "@electron/main/services";
import { providerStorage } from "@electron/main/services/storage-service/provider-storage";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";
import ky from "ky";

const userAgent = getCustomUserAgentFragment();

export const cloudModeKy = ky.create({
	timeout: 60000,
	prefixUrl: "http://placeholder:3000",
	headers: {
		"User-Agent": userAgent,
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
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
