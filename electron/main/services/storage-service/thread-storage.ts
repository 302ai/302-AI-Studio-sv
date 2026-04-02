import {
	prefixStorage,
	type ThreadData,
	type ThreadMetadata,
	type ThreadParmas,
} from "@shared/types";
import { storageService, StorageService } from ".";
import { createLogger } from "@shared/logger";

const logger = createLogger("services");
import { emitter } from "../broadcast-service";
import { chatParametersService } from "../chat-parameters-service";
import { codeAgentService } from "../code-agent-service";

export class ThreadStorage extends StorageService<ThreadMetadata> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "ThreadStorage");
	}

	private async getThreadMetadata(): Promise<ThreadMetadata | null> {
		const maxRetries = 3;
		const delayMs = 50;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const result = await this.getItemInternal("thread-metadata");
			if (result !== null) {
				return result;
			}

			if (attempt < maxRetries - 1) {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		return null;
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

	/**
	 * Clean up all thread-related data from storage and services
	 * This method removes all data associated with a thread, including:
	 * - Thread metadata
	 * - Chat messages
	 * - UI state
	 * - Plan answers
	 * - HTML preview deployments
	 * - Agent preview data
	 * - Code agent state
	 * - Chat parameters
	 * @param threadId - The thread ID to clean up
	 */
	async cleanupThreadData(threadId: string): Promise<void> {
		await Promise.all([
			storageService.removeItemInternal("app-thread:" + threadId),
			storageService.removeItemInternal("app-chat-messages:" + threadId),
			storageService.removeItemInternal("app-chat-ui-state:" + threadId),
			storageService.removeItemInternal("plan-answers:" + threadId),
			storageService.removeItemInternal("html-preview-deployments:" + threadId),
			storageService.removeItemInternal("AgentPreviewStorage:agent-preview-data-" + threadId),
			storageService.removeItemInternal("OpenClawStorage:openclaw-config-state-" + threadId),
			codeAgentService.removeCodeAgentState(threadId),
			chatParametersService.removeChatParameters(threadId),
		]);
	}

	async deleteThread(threadId: string): Promise<void> {
		try {
			// Remove from metadata first
			await this.removeThread(threadId);

			// Use unified cleanup method
			await this.cleanupThreadData(threadId);

			emitter.emit("thread:thread-deleted", { threadId });
		} catch (error) {
			logger.error(`Failed to delete thread ${threadId}:`, error);
			throw error;
		}
	}

	async renameThread(threadId: string, newName: string): Promise<void> {
		try {
			const threadKey = "app-thread:" + threadId;
			await storageService.setItemInternal(threadKey, {
				...((await storageService.getItemInternal(threadKey)) as ThreadParmas),
				title: newName,
				updatedAt: new Date(),
			});
		} catch (error) {
			logger.error(`Failed to rename thread ${threadId}:`, error);
			throw error;
		}
	}

	async addFavorite(threadId: string): Promise<void> {
		const metadata = await this.getThreadMetadata();
		if (metadata && !metadata.favorites.includes(threadId)) {
			metadata.favorites.push(threadId);
			await this.setItemInternal("thread-metadata", metadata);
		}
	}

	async removeFavorite(threadId: string): Promise<void> {
		const metadata = await this.getThreadMetadata();
		if (metadata) {
			const index = metadata.favorites.indexOf(threadId);
			if (index > -1) {
				metadata.favorites.splice(index, 1);
				await this.setItemInternal("thread-metadata", metadata);
			}
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
			logger.error("Failed to get thread:", error);
			return null;
		}
	}

	async getThreadsData(): Promise<Array<ThreadData> | null> {
		try {
			const metadata = await this.getThreadMetadata();
			if (!metadata) {
				return null;
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
					logger.warn(`Failed to load thread ${threadId}:`, error);
				}
			}

			allThreads.sort((a, b) => {
				// if (a.isFavorite && !b.isFavorite) return -1;
				// if (!a.isFavorite && b.isFavorite) return 1;

				const dateA = new Date(a.thread.updatedAt).getTime();
				const dateB = new Date(b.thread.updatedAt).getTime();
				return dateB - dateA;
			});

			return allThreads;
		} catch (error) {
			logger.error("Failed to get threads:", error);
			return null;
		}
	}

	/**
	 * Delete all threads that have a specific apiKeyHash
	 * Used when logging out to clean up sessions associated with a specific account
	 * @param apiKeyHash - The hash of the API key to match
	 * @returns Object containing count of deleted threads and their IDs
	 */
	async deleteThreadsByApiKeyHash(
		apiKeyHash: string,
	): Promise<{ deletedCount: number; deletedThreadIds: string[] }> {
		try {
			// IMPORTANT:
			// Do NOT rely on ThreadStorage metadata (threadIds). We only add threadIds when a message is sent
			// (see threadService.addThread usage), so "new / empty" chats may not be tracked in metadata yet.
			// To guarantee we delete *all* sessions associated with apiKeyHash, we scan persisted thread files.
			const allKeys = await storageService.getKeysInternal();
			const threadKeys = allKeys.filter((key) => key.startsWith("app-thread:"));

			const deletedThreadIds: string[] = [];
			for (const threadKey of threadKeys) {
				// Defensive: normalize potential ".json" suffix from storage drivers
				const rawId = threadKey.slice("app-thread:".length);
				const threadId = rawId.endsWith(".json") ? rawId.slice(0, -".json".length) : rawId;

				const thread = (await storageService.getItemInternal(
					"app-thread:" + threadId,
				)) as ThreadParmas | null;
				if (!thread) continue;

				// Back-compat:
				// - Older boot-created initial tabs may have no apiKeyHash persisted.
				// - Treat 302AI-selected threads without apiKeyHash as associated, so logout cleanup
				//   behaves as users expect (clears those sessions too).
				const isAssociatedByHash = thread.apiKeyHash === apiKeyHash;
				const isAssociatedLegacy =
					!thread.apiKeyHash && (thread as ThreadParmas).selectedModel?.providerId === "302AI";

				if (isAssociatedByHash || isAssociatedLegacy) {
					try {
						await this.deleteThread(threadId);
						deletedThreadIds.push(threadId);
						logger.info(`[ThreadStorage] Deleted thread ${threadId} with matching apiKeyHash`);
					} catch (error) {
						logger.error(`Failed to delete thread ${threadId}:`, error);
					}
				}
			}

			return { deletedCount: deletedThreadIds.length, deletedThreadIds };
		} catch (error) {
			logger.error("Failed to delete threads by apiKeyHash:", error);
			return { deletedCount: 0, deletedThreadIds: [] };
		}
	}

	/**
	 * Clear selectedModel references from all threads for deleted models
	 * Used when models are deleted to prevent stale references
	 * @param deletedModelIds - Set of model IDs that were deleted
	 * @returns Number of threads that had their selectedModel cleared
	 */
	async clearDeletedModelReferences(deletedModelIds: Set<string>): Promise<number> {
		try {
			const metadata = await this.getThreadMetadata();
			if (!metadata) return 0;

			let clearedCount = 0;

			for (const threadId of metadata.threadIds) {
				try {
					const threadKey = "app-thread:" + threadId;
					const thread = (await storageService.getItemInternal(threadKey)) as ThreadParmas;
					if (thread && thread.selectedModel && deletedModelIds.has(thread.selectedModel.id)) {
						// Clear the selectedModel reference
						await storageService.setItemInternal(threadKey, {
							...thread,
							selectedModel: null,
						});
						clearedCount++;
						logger.info(
							`[ThreadStorage] Cleared selectedModel reference for deleted model ${thread.selectedModel.id} in thread ${threadId}`,
						);
					}
				} catch (error) {
					logger.warn(`Failed to clear model reference in thread ${threadId}:`, error);
				}
			}

			return clearedCount;
		} catch (error) {
			logger.error("Failed to clear deleted model references:", error);
			return 0;
		}
	}
}

export const threadStorage = new ThreadStorage();
