import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { ThreadMetadata } from "@shared/types";
import { debounce } from "es-toolkit";

const { threadService, broadcastService } = window.electronAPI;
const { onThreadListUpdate } = window.electronAPI;

export const persistedThreadState = new PersistedState<ThreadMetadata>(
	"ThreadStorage:thread-metadata",
	{
		threadIds: [],
		favorites: [],
	} as ThreadMetadata,
	false, // 禁用 PersistedState 的 debounce，改为在这里控制
);

class ThreadsState {
	#threadIds = $derived(persistedThreadState.current.threadIds);
	// #favorites = $derived(persistedThreadState.current.favorites);
	#lastSyncTime = $state(Date.now());

	constructor() {
		onThreadListUpdate(() => {
			console.log("Threads updated from other tab, triggering sync");
			this.#lastSyncTime = Date.now();
		});
	}

	threads = $derived.by(async () => {
		const threadIds = this.#threadIds;
		const lastSyncTime = this.#lastSyncTime;

		console.log("Thread recalculation triggered by:", {
			threadIdsLength: threadIds.length,
			lastSyncTime: lastSyncTime,
		});

		if (threadIds.length === 0) return [];
		try {
			const threadsData = await threadService.getThreads();
			return threadsData ?? [];
		} catch (error) {
			console.error("Failed to load threads:", error);
			return [];
		}
	});

	activeThreadId = $state<string>(window.thread.id);

	// #isFavorite(threadId: string): boolean {
	// 	return this.#favorites.includes(threadId);
	// }

	toggleFavorite = debounce(async (threadId: string) => {
		const current = persistedThreadState.current;
		const isFavorite = current.favorites.includes(threadId);

		let newFavorites: string[];
		if (isFavorite) {
			newFavorites = current.favorites.filter((id) => id !== threadId);
		} else {
			newFavorites = [...current.favorites, threadId];
		}

		persistedThreadState.current = {
			threadIds: current.threadIds,
			favorites: newFavorites,
		};

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
