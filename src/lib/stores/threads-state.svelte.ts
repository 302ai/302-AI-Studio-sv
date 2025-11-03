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

			this.threads = threadsData ?? currentThreads;
		} catch (error) {
			console.error("Failed to load threads:", error);
			this.threads = currentThreads;
		}
	}

	activeThreadId = $state<string>(window.thread.id);

	toggleFavorite = debounce(async (threadId: string) => {
		const threadData = this.threads.find((t) => t.threadId === threadId);
		const isFavoriteNow = threadData?.isFavorite ?? false;

		if (isFavoriteNow) {
			await threadService.removeFavorite(threadId);
		} else {
			await threadService.addFavorite(threadId);
		}

		await broadcastService.broadcastToAll("thread-list-updated", {});
	}, 200);

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
				// 主动从本地状态中移除该 thread，确保 UI 立即更新
				this.threads = this.threads.filter((t) => t.threadId !== threadId);
			}
			return success;
		} catch (error) {
			console.error("Failed to delete thread:", error);
			return false;
		}
	}
}

export const threadsState = new ThreadsState();
