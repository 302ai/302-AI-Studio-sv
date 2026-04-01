import { SvelteMap } from "svelte/reactivity";
import { createLogger } from "@shared/logger";

const logger = createLogger("state");

class ThreadBusyState {
	// Map to store thread busy state: threadId -> { isBusy: boolean, reason?: string }
	private busyMap = new SvelteMap<string, { isBusy: boolean; reason?: string }>();

	constructor() {
		this.init();
	}

	private async init() {
		try {
			// Get initial busy threads from main process
			const initialBusyThreads = await window.electronAPI.threadStateService.getBusyThreads();
			logger.info("Initial busy threads:", initialBusyThreads);
			if (initialBusyThreads) {
				(
					Object.entries(initialBusyThreads) as [string, { isBusy: boolean; reason?: string }][]
				).forEach(([threadId, state]) => {
					this.busyMap.set(threadId, state);
				});
			}
		} catch (error) {
			logger.error("Failed to get initial busy threads:", error);
		}

		// Listen for cross-process busy state changes
		window.electronAPI.onThreadBusyStateChanged(
			(event: { threadId: string; isBusy: boolean; reason?: string }) => {
				logger.info("Busy state changed:", event);
				if (event.isBusy) {
					this.busyMap.set(event.threadId, { isBusy: true, reason: event.reason });
				} else {
					this.busyMap.delete(event.threadId);
				}
			},
		);
	}

	/**
	 * Check if a thread is busy (streaming or generating title)
	 */
	isBusy(threadId: string | undefined): boolean {
		if (!threadId) return false;
		return this.busyMap.has(threadId);
	}

	/**
	 * Get the reason why a thread is busy
	 */
	getReason(threadId: string | undefined): string | undefined {
		if (!threadId) return undefined;
		return this.busyMap.get(threadId)?.reason;
	}
}

export const threadBusyState = new ThreadBusyState();
