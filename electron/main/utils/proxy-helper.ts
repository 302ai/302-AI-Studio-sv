import { fetch as undiciFetch, ProxyAgent } from "undici";
import { generalSettingsStorage } from "../services/storage-service/general-settings-storage";
import { createLogger } from "@shared/logger";

const logger = createLogger("utils");

let cachedProxyAgent: ProxyAgent | null = null;
let cachedProxyUrl: string | null = null;

/**
 * Get the ProxyAgent instance for the current proxy settings.
 * Returns undefined if proxy is disabled or not configured.
 * Caches the ProxyAgent instance to avoid creating multiple instances.
 */
export async function getProxyAgent(): Promise<ProxyAgent | undefined> {
	const proxySettings = await generalSettingsStorage.getProxySettings();

	if (!proxySettings.enabled || !proxySettings.host || !proxySettings.port) {
		return undefined;
	}

	const proxyUrl = `http://${proxySettings.host}:${proxySettings.port}`;

	// Return cached agent if proxy URL hasn't changed
	if (cachedProxyAgent && cachedProxyUrl === proxyUrl) {
		return cachedProxyAgent;
	}

	// Create new ProxyAgent with HTTP/2 disabled for better proxy compatibility
	logger.info(`[Proxy] Creating ProxyAgent for: ${proxyUrl}`);
	cachedProxyUrl = proxyUrl;
	cachedProxyAgent = new ProxyAgent({
		uri: proxyUrl,
		allowH2: false,
	});

	return cachedProxyAgent;
}

/**
 * Clear the cached ProxyAgent instance.
 * Should be called when proxy settings are changed.
 */
export function clearProxyAgentCache(): void {
	logger.info("[Proxy] Clearing ProxyAgent cache");
	cachedProxyAgent = null;
	cachedProxyUrl = null;
}

/**
 * Create a fetch function that uses the proxy if configured.
 * This uses undici's fetch which natively supports the dispatcher option.
 * @returns A fetch function that will use proxy if enabled, or standard fetch if disabled.
 */
export async function createProxyFetch(): Promise<typeof fetch> {
	const proxySettings = await generalSettingsStorage.getProxySettings();

	if (!proxySettings.enabled || !proxySettings.host || !proxySettings.port) {
		logger.debug("[Proxy] Proxy disabled, using standard fetch");
		return fetch; // Use global fetch when proxy is disabled
	}

	const proxyUrl = `http://${proxySettings.host}:${proxySettings.port}`;

	// Create ProxyAgent with HTTP/2 disabled for better proxy compatibility
	const proxyAgent = new ProxyAgent({
		uri: proxyUrl,
		// Disable HTTP/2 to avoid "http2.connect is not a function" error
		// Most proxies work better with HTTP/1.1
		allowH2: false,
	});

	logger.debug(`[Proxy] Creating undici fetch with ProxyAgent (HTTP/1.1 only): ${proxyUrl}`);

	// Return a wrapper function that uses undici's fetch with the proxy dispatcher
	// We need to cast types because undici's fetch has slightly different types than standard fetch
	// but they are compatible at runtime
	return (async (url: RequestInfo | URL, init?: RequestInit) => {
		// Parse URL to extract hostname and full URL string
		// Handle Request object for undici compatibility
		let urlString: string;
		let fetchInit = init;

		if (url instanceof Request) {
			// Extract URL from Request object
			urlString = url.url;
			// Merge Request's properties with provided init
			fetchInit = {
				method: url.method,
				headers: url.headers,
				body: url.body,
				...init,
			};
		} else if (url instanceof URL) {
			urlString = url.href;
		} else {
			urlString = url;
		}

		const parsedUrl = new URL(urlString);

		// Check if this is a localhost request
		const isLocalhost =
			parsedUrl.hostname === "localhost" ||
			parsedUrl.hostname === "127.0.0.1" ||
			parsedUrl.hostname === "::1";

		// Log request details
		logger.info(`[Proxy] Fetch request: ${parsedUrl.href}`);
		logger.debug(`[Proxy] - Hostname: ${parsedUrl.hostname}`);
		logger.debug(`[Proxy] - Is localhost: ${isLocalhost}`);

		// Bypass proxy for localhost requests
		if (isLocalhost) {
			logger.info(`[Proxy] Bypassing proxy for localhost request: ${parsedUrl.href}`);
			try {
				const response = await fetch(url, init);
				logger.info(
					`[Proxy] Localhost fetch success: ${parsedUrl.href} - Status: ${response.status}`,
				);
				return response;
			} catch (error) {
				logger.error(`[Proxy] Localhost fetch failed: ${parsedUrl.href}`, error);
				throw error;
			}
		}

		// Use proxy for non-localhost requests
		logger.debug(`[Proxy] Using proxy for: ${parsedUrl.href} via ${proxyUrl}`);
		try {
			// Cast to unknown first to bypass type incompatibilities between standard fetch and undici fetch
			// They are functionally compatible but have minor type differences
			// Use urlString instead of url to ensure undici gets a string, not a Request object
			const response = (await undiciFetch(
				urlString as unknown as Parameters<typeof undiciFetch>[0],
				{
					...fetchInit,
					dispatcher: proxyAgent,
				} as Parameters<typeof undiciFetch>[1],
			)) as unknown as Response;
			logger.info(
				`[Proxy] Proxied fetch success: ${parsedUrl.href} - Status: ${response.status}`,
			);
			return response;
		} catch (error) {
			logger.error(`[Proxy] Proxied fetch failed: ${parsedUrl.href}`, error);
			throw error;
		}
	}) as typeof fetch;
}
