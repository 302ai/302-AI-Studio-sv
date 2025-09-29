import {
	prefixStorage,
	type ThreadData,
	type ThreadMetadata,
	type ThreadParmas,
} from "@shared/types";
import { webContents } from "electron";
import { storageService, StorageService } from ".";

export class ThreadStorage extends StorageService<ThreadMetadata> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "ThreadStorage");
	}

	private async getThreadMetadata(): Promise<ThreadMetadata | null> {
		const result = await this.getItemInternal("thread-metadata");
		if (!result) {
			const defaultMetadata: ThreadMetadata = {
				threadIds: [],
				favorites: [],
			};
			await this.setItemInternal("thread-metadata", defaultMetadata);
			return defaultMetadata;
		}
		return result;
	}

	async addThread(threadId: string): Promise<void> {
		const metadata = await this.getThreadMetadata();
		if (metadata && !metadata.threadIds.includes(threadId)) {
			metadata.threadIds.push(threadId);
			await this.setItemInternal("thread-metadata", metadata);
		}
	}

	async removeThread(threadId: string): Promise<void> {
		const metadata = await this.getThreadMetadata();
		if (metadata) {
			const threadIndex = metadata.threadIds.indexOf(threadId);
			if (threadIndex > -1) {
				metadata.threadIds.splice(threadIndex, 1);
			}

			const favoriteIndex = metadata.favorites.indexOf(threadId);
			if (favoriteIndex > -1) {
				metadata.favorites.splice(favoriteIndex, 1);
			}

			await this.setItemInternal("thread-metadata", metadata);
		}
	}

	async deleteThread(threadId: string): Promise<void> {
		try {
			// Remove from metadata first
			await this.removeThread(threadId);

			// Delete the actual thread data file
			const threadKey = "app-thread:" + threadId;
			await storageService.removeItemInternal(threadKey);
		} catch (error) {
			console.error(`Failed to delete thread ${threadId}:`, error);
			throw error;
		}
	}

	async getThread(threadId: string): Promise<ThreadData | null> {
		try {
			const metadata = await this.getThreadMetadata();
			if (!metadata || !metadata.threadIds.includes(threadId)) {
				return null;
			}

			const thread = (await storageService.getItemInternal(
				"app-thread:" + threadId,
			)) as ThreadParmas;
			if (!thread || !thread.updatedAt) {
				return null;
			}

			return {
				threadId,
				thread,
				isFavorite: metadata.favorites.includes(threadId),
			};
		} catch (error) {
			console.error("Failed to get thread:", error);
			return null;
		}
	}

	async getThreadsData(): Promise<Array<ThreadData> | null> {
		try {
			const metadata = await this.getThreadMetadata();
			if (!metadata || metadata.threadIds.length === 0) {
				return [];
			}

			const allThreads: Array<ThreadData> = [];

			for (const threadId of metadata.threadIds) {
				try {
					const thread = (await storageService.getItemInternal(
						"app-thread:" + threadId,
					)) as ThreadParmas;
					if (thread) {
						allThreads.push({
							threadId,
							thread,
							isFavorite: metadata.favorites.includes(threadId),
						});
					}
				} catch (error) {
					console.warn(`Failed to load thread ${threadId}:`, error);
				}
			}

			allThreads.sort((a, b) => {
				if (a.isFavorite && !b.isFavorite) return -1;
				if (!a.isFavorite && b.isFavorite) return 1;

				const dateA = new Date(a.thread.updatedAt).getTime();
				const dateB = new Date(b.thread.updatedAt).getTime();
				return dateB - dateA;
			});

			return allThreads;
		} catch (error) {
			console.error("Failed to get threads:", error);
			return null;
		}
	}

	// Override setItemInternal to use the prefixed key for sync messages
	async setItemInternal(key: string, value: ThreadMetadata): Promise<void> {
		const versionedValue = this.addVersionIfNeeded(value);
		await this.storage.setItem(this.ensureJsonExtension(key), versionedValue);

		// Use the prefixed key for sync messages to match frontend expectations
		const prefixedKey = `ThreadStorage:${key}`;
		const allWebContents = webContents.getAllWebContents();
		allWebContents.forEach((wc) => {
			if (!wc.isDestroyed()) {
				wc.send(`sync:${prefixedKey}`, versionedValue);
			}
		});
	}
}

export const threadStorage = new ThreadStorage();
