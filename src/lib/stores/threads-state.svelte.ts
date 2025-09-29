import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { ThreadMetadata } from "@shared/types";

const { threadService } = window.electronAPI;

export const persistedThreadState = new PersistedState<ThreadMetadata>(
	"ThreadStorage:thread-metadata",
	{
		threadIds: [],
		favorites: [],
	} as ThreadMetadata,
);

class ThreadsState {
	threadIds = $derived(persistedThreadState.current.threadIds);
	favorites = $derived(persistedThreadState.current.favorites);

	threads = $derived.by(async () => {
		const threadIds = this.threadIds;
		if (threadIds.length === 0) return [];
		try {
			const threadsData = await threadService.getThreads();
			return threadsData || [];
		} catch (error) {
			console.error("Failed to load threads:", error);
			return [];
		}
	});

	addThread(threadId: string): void {
		if (!this.threadIds.includes(threadId)) {
			persistedThreadState.current.threadIds.push(threadId);
		}
	}

	removeThread(threadId: string): void {
		const index = persistedThreadState.current.threadIds.indexOf(threadId);
		if (index > -1) {
			persistedThreadState.current.threadIds.splice(index, 1);
		}

		this.removeFavorite(threadId);
	}

	addFavorite(threadId: string): void {
		if (!this.favorites.includes(threadId)) {
			persistedThreadState.current.favorites.push(threadId);
		}
	}

	removeFavorite(threadId: string): void {
		const index = persistedThreadState.current.favorites.indexOf(threadId);
		if (index > -1) {
			persistedThreadState.current.favorites.splice(index, 1);
		}
	}

	async toggleFavorite(threadId: string): Promise<void> {
		try {
			await threadService.toggleThreadFavorite(threadId);
		} catch (error) {
			console.error("Failed to toggle favorite:", error);
		}
	}

	isFavorite(threadId: string): boolean {
		return this.favorites.includes(threadId);
	}
}

export const threadsState = new ThreadsState();
