import type { ThreadData } from "@shared/types";
import { BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { isNull } from "es-toolkit";
import { broadcastService } from "../broadcast-service";
import { tabStorage } from "../storage-service/tab-storage";
import { threadStorage } from "../storage-service/thread-storage";
import { tabService } from "../tab-service";

export class ThreadService {
	async addThread(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			await threadStorage.addThread(threadId);
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to add thread:", error);
			return false;
		}
	}

	async getThreads(_event: IpcMainInvokeEvent): Promise<ThreadData[] | null> {
		try {
			return await threadStorage.getThreadsData();
		} catch (error) {
			console.error("ThreadService: Failed to get threads:", error);
			return null;
		}
	}

	async getThread(_event: IpcMainInvokeEvent, threadId: string): Promise<ThreadData | null> {
		try {
			return await threadStorage.getThread(threadId);
		} catch (error) {
			console.error("ThreadService: Failed to get thread:", error);
			return null;
		}
	}

	async deleteThread(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			await threadStorage.deleteThread(threadId);
			broadcastService.broadcastChannelToAll("broadcast-event", {
				broadcastEvent: "thread-list-updated",
				data: {},
			});
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to delete thread:", error);
			return false;
		}
	}

	async renameThread(
		_event: IpcMainInvokeEvent,
		threadId: string,
		newName: string,
	): Promise<boolean> {
		try {
			await threadStorage.renameThread(threadId, newName);
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to rename thread:", error);
			return false;
		}
	}

	async addFavorite(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			await threadStorage.addFavorite(threadId);
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to add favorite:", error);
			return false;
		}
	}

	async removeFavorite(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			await threadStorage.removeFavorite(threadId);
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to remove favorite:", error);
			return false;
		}
	}

	/**
	 * Delete all threads that match a specific apiKeyHash
	 * Also closes any tabs that reference the deleted threads
	 * Used when logging out to clean up associated sessions
	 */
	async deleteThreadsByApiKeyHash(_event: IpcMainInvokeEvent, apiKeyHash: string): Promise<number> {
		try {
			const { deletedCount, deletedThreadIds } =
				await threadStorage.deleteThreadsByApiKeyHash(apiKeyHash);

			if (deletedCount > 0) {
				// Close tabs that reference deleted threads
				await this.closeTabsForThreads(deletedThreadIds);

				broadcastService.broadcastChannelToAll("broadcast-event", {
					broadcastEvent: "thread-list-updated",
					data: {},
				});
			}
			return deletedCount;
		} catch (error) {
			console.error("ThreadService: Failed to delete threads by apiKeyHash:", error);
			return 0;
		}
	}

	/**
	 * Clear selectedModel references from all threads for deleted models
	 * Used when models are deleted to prevent stale references
	 * @param deletedModelIds - Array of model IDs that were deleted
	 * @returns Number of threads that had their selectedModel cleared
	 */
	async clearDeletedModelReferences(
		_event: IpcMainInvokeEvent,
		deletedModelIds: string[],
	): Promise<number> {
		try {
			const deletedModelIdsSet = new Set(deletedModelIds);
			const clearedCount = await threadStorage.clearDeletedModelReferences(deletedModelIdsSet);

			if (clearedCount > 0) {
				// Broadcast thread list update to refresh UI
				broadcastService.broadcastChannelToAll("broadcast-event", {
					broadcastEvent: "thread-list-updated",
					data: {},
				});
			}

			return clearedCount;
		} catch (error) {
			console.error("ThreadService: Failed to clear deleted model references:", error);
			return 0;
		}
	}

	/**
	 * Close tabs that reference specific thread IDs from all windows
	 */
	private async closeTabsForThreads(threadIds: string[]): Promise<void> {
		if (threadIds.length === 0) return;

		const threadIdSet = new Set(threadIds);
		const tabState = await tabStorage.getPersistedTabState();
		if (isNull(tabState)) return;

		let hasChanges = false;

		// Remove tabs with matching threadIds from each window
		for (const [windowId, windowData] of Object.entries(tabState)) {
			const originalLength = windowData.tabs.length;
			const tabsToClose = windowData.tabs.filter((tab) => threadIdSet.has(tab.threadId));
			const remainingTabs = windowData.tabs.filter((tab) => !threadIdSet.has(tab.threadId));

			if (remainingTabs.length !== originalLength) {
				hasChanges = true;
				console.log(
					`[ThreadService] Closing ${originalLength - remainingTabs.length} tab(s) in window ${windowId}`,
				);

				// Actually close the WebContentsViews for the tabs being removed
				const numericWindowId = Number.parseInt(windowId, 10);
				if (!Number.isNaN(numericWindowId)) {
					const browserWindow = BrowserWindow.fromId(numericWindowId);
					if (browserWindow && !browserWindow.isDestroyed()) {
						for (const tab of tabsToClose) {
							console.log(`[ThreadService] Removing tab view ${tab.id} from window ${windowId}`);
							await tabService.removeTab(browserWindow, tab.id);
						}
					}
				}

				// If all tabs were removed, we need to ensure there's at least one tab
				// This will be handled by the frontend when it receives the broadcast
				windowData.tabs = remainingTabs;

				// If the active tab was removed, activate the first remaining tab
				if (remainingTabs.length > 0) {
					const hasActiveTab = remainingTabs.some((tab) => tab.active);
					if (!hasActiveTab) {
						remainingTabs[0].active = true;
						// Also activate the first remaining tab in the tabService
						const numericWindowId = Number.parseInt(windowId, 10);
						if (!Number.isNaN(numericWindowId)) {
							const browserWindow = BrowserWindow.fromId(numericWindowId);
							if (browserWindow && !browserWindow.isDestroyed()) {
								await tabService.focusTabInWindow(browserWindow, remainingTabs[0].id);
							}
						}
					}
				}
			}
		}

		if (hasChanges) {
			await tabStorage.setItemInternal("tab-bar-state", tabState);

			// Broadcast tab state update to all windows
			broadcastService.broadcastChannelToAll("broadcast-event", {
				broadcastEvent: "tab-state-updated",
				data: {},
			});
		}
	}
}

export const threadService = new ThreadService();
