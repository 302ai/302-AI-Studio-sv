import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { ThreadData, ThreadMetadata } from "@shared/types";
import { debounce } from "es-toolkit";

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
		// Initialize threads on first load
		this.#loadThreads();

		// Re-sync threads when broadcast received
		onThreadListUpdate(() => {
			console.log("Threads updated from broadcast, re-syncing");
			this.#loadThreads();
		});
	}

	async #loadThreads(): Promise<void> {
		try {
			const threadsData = await threadService.getThreads();
			this.threads = threadsData ?? [];
			console.log("Threads loaded:", this.threads.length);
		} catch (error) {
			console.error("Failed to load threads:", error);
			this.threads = [];
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

	toggleFavorite = debounce(async (threadId: string) => {
		const threadData = this.threads.find((t) => t.threadId === threadId);
		if (threadData) {
			threadData.isFavorite = !threadData.isFavorite;
		}

		const current = persistedThreadState.current;

		if (this.#isFavorite(threadId)) {
			this.#removeFavorite(threadId, current);
		} else {
			this.#addFavorite(threadId, current);
		}

		await broadcastService.broadcastExcludeSource("thread-list-updated", { threadId });
	}, 150);

	async renameThread(threadId: string, newName: string): Promise<void> {
		await threadService.renameThread(threadId, newName);
		await broadcastService.broadcastToAll("thread-list-updated", { threadId });
	}

	async deleteThread(threadId: string): Promise<boolean> {
		try {
			const success = await threadService.deleteThread(threadId);
			if (success) {
				// Remove from local state immediately for UI responsiveness
				// const currentMetadata = persistedThreadState.current;
				// const threadIndex = currentMetadata.threadIds.indexOf(threadId);
				// if (threadIndex > -1) {
				// 	currentMetadata.threadIds.splice(threadIndex, 1);
				// }
				// const favoriteIndex = currentMetadata.favorites.indexOf(threadId);
				// if (favoriteIndex > -1) {
				// 	currentMetadata.favorites.splice(favoriteIndex, 1);
				// }

				// If the deleted thread was the active one, clear the active thread
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
