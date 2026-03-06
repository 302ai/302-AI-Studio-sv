import { session } from "electron";
import { getCustomUserAgentFragment } from "./user-agent";

export function setupNetworkInterceptor(): void {
	const customUAFragment = getCustomUserAgentFragment();

	// Append to default User Agent for the session
	const defaultUserAgent = session.defaultSession.getUserAgent();
	session.defaultSession.setUserAgent(`${defaultUserAgent} ${customUAFragment}`);

	// Intercept requests to ensure headers are present and correct
	session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
		const { requestHeaders } = details;

		// Ensure User-Agent has our fragment
		if (requestHeaders["User-Agent"] && !requestHeaders["User-Agent"].includes("Studio302/")) {
			requestHeaders["User-Agent"] += ` ${customUAFragment}`;
		}

		requestHeaders["HTTP-Referer"] = "https://studio.302.ai/";
		requestHeaders["X-Title"] = "302.AI Studio";

		callback({ requestHeaders });
	});

	// Intercept responses to allow framing localhost content (e.g. OpenClaw WebUI)
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		const { responseHeaders, url } = details;

		if (
			responseHeaders &&
			(url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:"))
		) {
			// Remove restrictive headers that prevent framing
			const headersToRemove = [
				"content-security-policy",
				"Content-Security-Policy",
				"x-frame-options",
				"X-Frame-Options",
			];

			for (const header of headersToRemove) {
				if (responseHeaders[header]) {
					delete responseHeaders[header];
				}
			}
		}

		callback({ cancel: false, responseHeaders });
	});
}
