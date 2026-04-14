import { m } from "$lib/paraglide/messages";
import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
import ky from "ky";
import { toast } from "svelte-sonner";

const { getUserAgentFragment } = window.electronAPI.appService;

/**
 * Factory function to create a Ky instance for local Code Agent mode
 * - Uses http://localhost:<port> (default 8123)
 * - No Authorization header needed (local sandbox doesn't require API key)
 * - Dynamically updates port if runtime uses a different one
 *
 * NOTE: This is a factory function (not a singleton) to avoid connection reuse issues.
 * When the sandbox restarts with a different port, stale HTTP/2 connections from a
 * singleton instance can cause ERR_ALPN_NEGOTIATION_FAILED errors. Creating a fresh
 * instance per request ensures each request uses the current port.
 */
export async function createLocalCodeAgentKy() {
	const prefixUrl =
		(await window.electronAPI.localVibeService.getLocalBaseUrl()) ?? "http://localhost:8123";

	return ky.create({
		timeout: 180000,
		prefixUrl: prefixUrl,
		headers: {
			"HTTP-Referer": "https://studio.302.ai/",
			"X-Title": "302.AI Studio",
		},
		retry: 3,
		fetch: async (input, init) => {
			try {
				return await fetch(input, init);
			} catch (error) {
				if (
					error instanceof Error &&
					error.message === "Failed to fetch" &&
					codeAgentState.type === "local"
				) {
					const toastId = "local-code-agent-connection-error";
					const isAlreadyVisible = toast.getActiveToasts().some((t) => t.id === toastId);

					if (!localEnvState.sandboxStarting && !isAlreadyVisible) {
						toast.error(m.code_agent_local_container_not_started(), {
							id: toastId,
							action: {
								label: m.toast_button_start_sandbox(),
								onClick: async () => {
									await localEnvState.startSandbox();
								},
							},
						});
					}
				}
				throw error;
			}
		},
		hooks: {
			beforeRequest: [
				async (request) => {
					const userAgent = await getUserAgentFragment();
					request.headers.set("User-Agent", userAgent);
				},
			],
		},
	});
}
