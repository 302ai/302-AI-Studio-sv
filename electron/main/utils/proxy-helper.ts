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

	// Create new ProxyAgent
	logger.info(`[Proxy] Creating ProxyAgent for: ${proxyUrl}`);
	cachedProxyUrl = proxyUrl;
	cachedProxyAgent = new ProxyAgent(proxyUrl);

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
		// Cast to unknown first to bypass type incompatibilities between standard fetch and undici fetch
		// They are functionally compatible but have minor type differences
		return undiciFetch(
			url as unknown as Parameters<typeof undiciFetch>[0],
			{
				...init,
				dispatcher: proxyAgent,
			} as Parameters<typeof undiciFetch>[1],
		) as unknown as Promise<Response>;
	}) as typeof fetch;
}
