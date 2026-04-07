import ky from "ky";
import { getCustomUserAgentFragment } from "@electron/main/utils/user-agent";

const userAgent = getCustomUserAgentFragment();

export const cloudModeKy = ky.create({
	timeout: 60000,
	prefixUrl: "http://192.168.199.116:8001",
	headers: {
		"User-Agent": userAgent,
		"HTTP-Referer": "https://studio.302.ai/",
		"X-Title": "302.AI Studio",
	},
	retry: 3,
	// TODO: Add fetch implementation for error handling/retries if needed
	// TODO: Add hooks for authentication or dynamic port handling if needed
});
