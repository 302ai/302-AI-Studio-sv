import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { ThreadData, ThreadMetadata } from "@shared/types";

const { threadService, broadcastService } = window.electronAPI;
const { onThreadListUpdate } = window.electronAPI;

export const persistedThreadState = new PersistedState<ThreadMetadata>(
	"ThreadStorage:thread-metadata",
	{
		threadIds: [],
		favorites: [],
	} as ThreadMetadata,
);

class ThreadsState {
	#favorites = $derived(persistedThreadState.current.favorites);
	threads = $state<ThreadData[]>([]);

	constructor() {
		this.#loadThreads();

		onThreadListUpdate(() => {
			console.log("Threads updated from broadcast, re-syncing");
			this.#loadThreads();
		});
	}

	async #loadThreads(): Promise<void> {
		const currentThreads = this.threads;
		try {
			const threadsData = await threadService.getThreads();

			if (!threadsData) {
				setTimeout(() => {
					this.#loadThreads();
				}, 100);
			}

			this.threads = threadsData ?? currentThreads;
			console.log("Threads loaded:", this.threads.length);
		} catch (error) {
			console.error("Failed to load threads:", error);
			this.threads = currentThreads;
		}
	}

	activeThreadId = $state<string>(window.thread.id);

	#addFavorite(threadId: string, current: ThreadMetadata): void {
		if (this.#isFavorite(threadId)) return;
		persistedThreadState.current = {
			threadIds: current.threadIds,
			favorites: [...current.favorites, threadId],
		};
	}

	#removeFavorite(threadId: string, current: ThreadMetadata): void {
		const index = current.favorites.indexOf(threadId);
		if (index === -1) return;
		persistedThreadState.current = {
			threadIds: current.threadIds,
			favorites: [...current.favorites.slice(0, index), ...current.favorites.slice(index + 1)],
		};
	}

	#isFavorite(threadId: string): boolean {
		return this.#favorites.includes(threadId);
	}

	toggleFavorite(threadId: string) {
		const current = persistedThreadState.current;
		const isFavoriteNow = current.favorites.includes(threadId);

		if (isFavoriteNow) {
			this.#removeFavorite(threadId, current);
		} else {
			this.#addFavorite(threadId, current);
		}

		const threadData = this.threads.find((t) => t.threadId === threadId);
		if (threadData) {
			threadData.isFavorite = !isFavoriteNow;
		}

		// Broadcast to other windows/tabs (excluding current source) with updated threads
		broadcastService.broadcastExcludeSource("thread-list-updated", {});
	}

	// toggleFavorite = debounce(async (threadId: string) => {
	// 	// Get current state from persisted storage (source of truth)
	// 	const current = persistedThreadState.current;
	// 	const isFavoriteNow = current.favorites.includes(threadId);

	// 	// Update persisted storage based on current actual state
	// 	if (isFavoriteNow) {
	// 		this.#removeFavorite(threadId, current);
	// 	} else {
	// 		this.#addFavorite(threadId, current);
	// 	}

	// 	// Update UI to match persisted state
	// 	const threadData = this.threads.find((t) => t.threadId === threadId);
	// 	if (threadData) {
	// 		threadData.isFavorite = !isFavoriteNow;
	// 	}

	// 	// Broadcast to other windows/tabs (excluding current source)
	// 	await broadcastService.broadcastExcludeSource("thread-list-updated", { threadId });
	// }, 150);

	async renameThread(threadId: string, newName: string): Promise<void> {
		await threadService.renameThread(threadId, newName);
		await broadcastService.broadcastToAll("thread-list-updated", { threadId });
	}

	async deleteThread(threadId: string): Promise<boolean> {
		try {
			const success = await threadService.deleteThread(threadId);
			if (success) {
				if (this.activeThreadId === threadId) {
					this.activeThreadId = "";
				}

				// Broadcast to other tabs about the deletion
				await broadcastService.broadcastExcludeSource("thread-list-updated", { threadId });
			}
			return success;
		} catch (error) {
			console.error("Failed to delete thread:", error);
			return false;
		}
	}
}

export const threadsState = new ThreadsState();
