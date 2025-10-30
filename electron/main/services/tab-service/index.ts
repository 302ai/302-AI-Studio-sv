import type { Tab, TabType, ThreadParmas } from "@shared/types";
import { BrowserWindow, WebContentsView, type IpcMainInvokeEvent } from "electron";
import { isNull, isUndefined } from "es-toolkit";
import { nanoid } from "nanoid";
import { stringify } from "superjson";
import { isMac, TITLE_BAR_HEIGHT } from "../../constants";
import { WebContentsFactory } from "../../factories/web-contents-factory";
import {
	withDevToolsShortcuts,
	withLifecycleHandlers,
	withLoadHandlers,
} from "../../mixins/web-contents-mixins";
import { TempStorage } from "../../utils/temp-storage";
import { shortcutService } from "../shortcut-service";
import { storageService } from "../storage-service";
import { tabStorage } from "../storage-service/tab-storage";
import { threadStorage } from "../storage-service/thread-storage";

type TabConfig = {
	title: string;
	getHref: (id: string) => string;
};

const TAB_CONFIGS: Record<TabType, TabConfig> = {
	chat: { title: "New Chat", getHref: (id) => `/chat/${id}` },
	settings: { title: "Settings", getHref: () => "/settings/general-settings" },
	aiApplications: { title: "AI Applications", getHref: () => "/ai-applications" },
} as const;

const getTabConfig = (type: TabType) => TAB_CONFIGS[type] || TAB_CONFIGS.chat;

export class TabService {
	private tabViewMap: Map<string, WebContentsView>;
	private tabMap: Map<string, Tab>;
	private windowTabView: Map<number, WebContentsView[]>;
	private windowActiveTabId: Map<number, string>;
	private windowShellView: Map<number, WebContentsView>;
	private tempFileRegistry: Map<string, string[]>; // tabId -> tempFilePaths[]

	// Preload management
	private preloadedViewPool: Map<string, WebContentsView>; // threadId -> preloaded view
	private preloadQueue: string[]; // threadIds waiting to be preloaded
	private isPreloading: boolean; // flag to prevent concurrent preloading
	private windowPreloadStatus: Map<number, boolean>; // windowId -> has started preloading
	private preloadingThreads: Set<string>; // threadIds currently being preloaded

	constructor() {
		this.tabViewMap = new Map();
		this.tabMap = new Map();
		this.windowTabView = new Map();
		this.windowActiveTabId = new Map();
		this.windowShellView = new Map();
		this.tempFileRegistry = new Map();

		// Initialize preload structures
		this.preloadedViewPool = new Map();
		this.preloadQueue = [];
		this.isPreloading = false;
		this.windowPreloadStatus = new Map();
		this.preloadingThreads = new Set();
	}

	private scheduleWindowResize(window: BrowserWindow) {
		if (window.isDestroyed()) return;
		setTimeout(() => {
			if (window.isDestroyed()) return;
			this.handleWindowResize(window);
		}, 0);
	}

	// ******************************* Private Methods ******************************* //
	private async newWebContentsView(windowId: number, tab: Tab): Promise<WebContentsView> {
		let view: WebContentsView;

		if (tab.type === "aiApplications") {
			view = WebContentsFactory.createAiApplicationView({
				windowId,
				type: "aiApplication",
			});
		} else {
			const [thread, messages] = await Promise.all([
				storageService.getItemInternal("app-thread:" + tab.threadId),
				storageService.getItemInternal("app-chat-messages:" + tab.threadId),
			]);

			const threadFilePath = TempStorage.writeData(thread, "thread");
			const messagesFilePath = TempStorage.writeData(messages, "messages");

			// Create view using factory
			view = WebContentsFactory.createTabView({
				windowId,
				type: "tab",
				tab,
				threadFilePath,
				messagesFilePath,
			});
		}

		// Add devTools shortcuts
		withDevToolsShortcuts(view);
		withLoadHandlers(view, {
			baseUrl:
				tab.type === "aiApplications"
					? tab.href
					: MAIN_WINDOW_VITE_DEV_SERVER_URL || "app://localhost",
			// autoOpenDevTools: !!MAIN_WINDOW_VITE_DEV_SERVER_URL,
		});

		// Attach shortcut engine to tab view
		shortcutService.getEngine().attachToView(view, windowId, tab.id);

		this.tabViewMap.set(tab.id, view);

		// Add lifecycle handlers
		const capturedTabId = tab.id;
		const capturedWindowId = windowId;
		withLifecycleHandlers(view, {
			onDestroyed: () => {
				// IMPORTANT: Check if this view is in the preload pool
				// If it is, it means the view was recycled and shouldn't be cleaned up
				const isInPool = Array.from(this.preloadedViewPool.values()).includes(view);
				if (isInPool) {
					console.log(
						`[Preload] View for tab ${capturedTabId} is in preload pool, skipping cleanup`,
					);
					return;
				}

				console.log(`Tab ${capturedTabId} webContents destroyed, cleaning up all mappings`);
				this.tabViewMap.delete(capturedTabId);
				this.tabMap.delete(capturedTabId);

				const windowViews = this.windowTabView.get(capturedWindowId);
				if (!isUndefined(windowViews)) {
					const updatedViews = windowViews.filter((v) => v !== view);
					this.windowTabView.set(capturedWindowId, updatedViews);
				}

				const activeTabId = this.windowActiveTabId.get(capturedWindowId);
				if (activeTabId === capturedTabId) {
					this.windowActiveTabId.delete(capturedWindowId);
				}

				this.cleanupTabTempFiles(capturedTabId);

				// Check if all mappings related to the destroyed tab have been properly cleaned up
				console.log(
					"Checking tabViewMap ---> ",
					this.tabViewMap.has(capturedTabId) ? "failed" : "passed",
				);
				console.log("Checking tabMap ---> ", this.tabMap.has(capturedTabId) ? "failed" : "passed");
				console.log(
					"Checking windowTabView ---> ",
					(this.windowTabView.get(capturedWindowId)?.includes(view) ?? false) ? "failed" : "passed",
				);
				console.log(
					"Checking windowActiveTabId ---> ",
					this.windowActiveTabId.get(capturedWindowId) === capturedTabId ? "failed" : "passed",
				);
				// console.log(
				// 	"Checking tempFileRegistry ---> ",
				// 	this.tempFileRegistry.has(capturedTabId) ? "failed" : "passed",
				// );
			},
			onWillPreventUnload: () => {
				console.log("view will prevent unload");
			},
		});

		return view;
	}

	private attachViewToWindow(window: BrowserWindow, view: WebContentsView) {
		window.contentView.addChildView(view);
		const { width, height } = window.getContentBounds();
		view.setBounds({ x: 0, y: TITLE_BAR_HEIGHT + 1, width, height: height - TITLE_BAR_HEIGHT - 1 });
	}

	private switchActiveTab(window: BrowserWindow, newActiveTabId: string) {
		const activeTabId = this.windowActiveTabId.get(window.id);
		if (!isUndefined(activeTabId)) {
			const prevView = this.tabViewMap.get(activeTabId);
			if (prevView) {
				prevView.setVisible(false);
			}
		}

		const newView = this.tabViewMap.get(newActiveTabId);
		if (!isUndefined(newView)) {
			newView.setVisible(true);
			newView.webContents.focus();
		}

		this.windowActiveTabId.set(window.id, newActiveTabId);
	}

	private cleanupTabTempFiles(tabId: string) {
		const tempFiles = this.tempFileRegistry.get(tabId);
		if (tempFiles) {
			tempFiles.forEach((filePath) => {
				TempStorage.cleanupFile(filePath);
			});
			this.tempFileRegistry.delete(tabId);
		}
	}

	// ******************************* Preload Methods ******************************* //
	/**
	 * Create a preloaded view for a thread without attaching it to a window
	 * The view is created and stored in the preloadedViewPool for later use
	 */
	private async createPreloadedView(
		windowId: number,
		threadId: string,
	): Promise<WebContentsView | null> {
		try {
			// Mark as preloading
			this.preloadingThreads.add(threadId);
			console.log(`[Preload] Creating preloaded view for thread ${threadId}`);

			// Get thread data from storage
			const threadData = await storageService.getItemInternal("app-thread:" + threadId);

			if (!threadData || typeof threadData !== "object" || !("title" in threadData)) {
				console.warn(`[Preload] Thread ${threadId} not found in storage, skipping`);
				this.preloadingThreads.delete(threadId);
				return null;
			}

			// Create a temporary tab object for the preloaded view
			const tempTab: Tab = {
				id: `preload-${threadId}-${Date.now()}`,
				title: threadData.title as string,
				href: `/chat/${threadId}`,
				type: "chat",
				active: false,
				threadId: threadId,
			};

			// Create the view using the existing method
			const view = await this.newWebContentsView(windowId, tempTab);

			// Set view as invisible (important!)
			view.setVisible(false);

			// Store in the preloaded view pool
			this.preloadedViewPool.set(threadId, view);

			// Remove from preloading set
			this.preloadingThreads.delete(threadId);

			console.log(`[Preload] Successfully created preloaded view for thread ${threadId}`);
			return view;
		} catch (error) {
			console.error(`[Preload] Failed to create preloaded view for thread ${threadId}:`, error);
			this.preloadingThreads.delete(threadId);
			return null;
		}
	}

	/**
	 * Get a view from the preloaded pool or create a new one
	 * If a preloaded view exists, it's removed from the pool and returned
	 * If the thread is currently being preloaded, wait for it
	 * Otherwise, a new view is created on-demand
	 */
	private async getOrCreateViewForThread(
		windowId: number,
		threadId: string,
		tab: Tab,
	): Promise<WebContentsView> {
		// Check if this thread is currently being preloaded
		if (this.preloadingThreads.has(threadId)) {
			console.log(`[Preload] Thread ${threadId} is currently being preloaded, waiting...`);

			// Wait for the preloading to complete (with timeout)
			const maxWaitTime = 10000; // 10 seconds max
			const startTime = Date.now();

			while (this.preloadingThreads.has(threadId) && Date.now() - startTime < maxWaitTime) {
				await new Promise((resolve) => setTimeout(resolve, 100)); // Wait 100ms
			}

			if (this.preloadingThreads.has(threadId)) {
				console.warn(
					`[Preload] Timeout waiting for thread ${threadId} to preload, creating new view`,
				);
			} else {
				console.log(`[Preload] Thread ${threadId} preloading completed, checking pool`);
			}
		}

		// Check if we have a preloaded view for this thread
		const preloadedView = this.preloadedViewPool.get(threadId);
		if (preloadedView && !preloadedView.webContents.isDestroyed()) {
			console.log(`[Preload] Using preloaded view for thread ${threadId}`);
			// Remove from pool since it's now being used
			this.preloadedViewPool.delete(threadId);

			// Find and clean up the old temporary tab ID
			// The preloaded view was created with a temporary tab ID starting with "preload-{threadId}-"
			const oldTabId = Array.from(this.tabMap.entries()).find(
				([_, t]) => t.threadId === threadId && t.id.startsWith(`preload-${threadId}-`),
			)?.[0];

			if (oldTabId) {
				console.log(`[Preload] Cleaning up temporary tab ID ${oldTabId}`);
				this.tabViewMap.delete(oldTabId);
				this.tabMap.delete(oldTabId);
			}

			// Update window ID in the preloaded view's WebContents
			// This is critical when tabs are moved to different windows
			// The preloaded view may have been created for a different window
			preloadedView.webContents
				.executeJavaScript(
					`
				window.windowId = "${windowId}";
				// Trigger TabBarState to refresh window ID
				if (window.dispatchEvent) {
					window.dispatchEvent(new CustomEvent('windowIdChanged', {
						detail: { newWindowId: "${windowId}" }
					}));
				}
			`,
				)
				.catch((error) => {
					console.error(
						`[Preload] Failed to update window ID for preloaded thread ${threadId}:`,
						error,
					);
				});

			// Re-attach shortcut engine with the correct window ID and tab ID
			// This is critical when the preloaded view is used in a different window
			// or with a different tab ID than it was created with
			shortcutService.getEngine().attachToView(preloadedView, windowId, tab.id);

			// Register with the actual tab ID
			this.tabViewMap.set(tab.id, preloadedView);
			this.tabMap.set(tab.id, tab);

			return preloadedView;
		}

		// No preloaded view available, create new one
		console.log(`[Preload] No preloaded view found for thread ${threadId}, creating new view`);
		return await this.newWebContentsView(windowId, tab);
	}

	/**
	 * Process the preload queue one thread at a time
	 * Uses setImmediate to avoid blocking the main thread
	 */
	private async processPreloadQueue(windowId: number): Promise<void> {
		if (this.isPreloading || this.preloadQueue.length === 0) {
			return;
		}

		this.isPreloading = true;
		const threadId = this.preloadQueue.shift();

		if (threadId) {
			try {
				// Check if already in pool (avoid duplicates)
				if (!this.preloadedViewPool.has(threadId)) {
					await this.createPreloadedView(windowId, threadId);
					console.log(
						`[Preload] Progress: ${this.preloadedViewPool.size} views preloaded, ${this.preloadQueue.length} remaining`,
					);
				}
			} catch (error) {
				console.error(`[Preload] Failed to preload thread ${threadId}:`, error);
			}
		}

		this.isPreloading = false;

		// Continue processing the queue using setImmediate
		if (this.preloadQueue.length > 0) {
			setImmediate(() => this.processPreloadQueue(windowId));
		} else {
			console.log(`[Preload] Completed preloading ${this.preloadedViewPool.size} threads`);
		}
	}

	/**
	 * Preload all threads for a window
	 * This is the main entry point for starting the preload process
	 */
	private async preloadAllThreads(windowId: number): Promise<void> {
		// Check if preloading has already started for this window
		if (this.windowPreloadStatus.get(windowId)) {
			console.log(`[Preload] Already started for window ${windowId}`);
			return;
		}

		console.log(`[Preload] Starting preload for window ${windowId}`);
		this.windowPreloadStatus.set(windowId, true);

		try {
			// Get all threads from storage
			const allThreads = await threadStorage.getThreadsData();
			if (!allThreads || allThreads.length === 0) {
				console.log("[Preload] No threads found to preload");
				return;
			}

			// Get currently open tabs in this window to exclude them
			const windowTabs = await tabStorage.getTabs(windowId.toString());
			const openThreadIds = new Set(
				(windowTabs || [])
					.filter((tab) => tab.type === "chat" && tab.threadId)
					.map((tab) => tab.threadId),
			);

			// Filter out threads that are already open in tabs
			const threadsToPreload = allThreads
				.filter(({ threadId }) => !openThreadIds.has(threadId))
				.map(({ threadId }) => threadId);

			console.log(
				`[Preload] Found ${allThreads.length} total threads, ${threadsToPreload.length} need preloading (${openThreadIds.size} already open)`,
			);

			if (threadsToPreload.length === 0) {
				console.log("[Preload] All threads are already open, nothing to preload");
				return;
			}

			// Add to preload queue
			this.preloadQueue.push(...threadsToPreload);

			// Start processing the queue
			this.processPreloadQueue(windowId);
		} catch (error) {
			console.error("[Preload] Failed to start preload:", error);
			this.windowPreloadStatus.set(windowId, false);
		}
	}

	/**
	 * Remove a thread from the preload pool
	 * Used when a thread is deleted - this actually closes the view
	 */
	private removeThreadFromPool(threadId: string): void {
		const view = this.preloadedViewPool.get(threadId);
		if (view) {
			console.log(`[Preload] Removing and closing view for deleted thread ${threadId}`);
			try {
				if (!view.webContents.isDestroyed()) {
					// Remove from window if attached
					const windows = BrowserWindow.getAllWindows();
					for (const window of windows) {
						try {
							window.contentView.removeChildView(view);
						} catch (_) {
							// View might not be attached to this window, ignore
						}
					}
					view.webContents.close({ waitForBeforeUnload: false });
				}
			} catch (error) {
				console.error(`[Preload] Error closing view for thread ${threadId}:`, error);
			}
			this.preloadedViewPool.delete(threadId);
		}

		// Also remove from preloading set if present
		this.preloadingThreads.delete(threadId);

		// Also remove from queue if present
		const queueIndex = this.preloadQueue.indexOf(threadId);
		if (queueIndex !== -1) {
			this.preloadQueue.splice(queueIndex, 1);
		}
	}

	/**
	 * Public method to handle thread deletion
	 * Called by threadService when a thread is deleted
	 */
	handleThreadDeleted(threadId: string): void {
		this.removeThreadFromPool(threadId);
	}

	// ******************************* Main Process Methods ******************************* //
	getActiveTabView(windowId: number): WebContentsView | null {
		const activeTabId = this.windowActiveTabId.get(windowId);
		if (isUndefined(activeTabId)) return null;
		return this.tabViewMap.get(activeTabId) || null;
	}

	async initWindowTabs(window: BrowserWindow, tabs: Tab[]): Promise<void> {
		let activeTabView: WebContentsView | null = null;
		let activeTabId: string | null = null;
		const views: WebContentsView[] = [];

		for (const tab of tabs) {
			const tabView = await this.newWebContentsView(window.id, tab);
			if (tab.active) {
				activeTabView = tabView;
				activeTabId = tab.id;
			} else {
				this.attachViewToWindow(window, tabView);
				tabView.setVisible(false);
			}
			this.tabMap.set(tab.id, tab);
			views.push(tabView);
		}

		this.windowTabView.set(window.id, views);

		if (activeTabView && activeTabId) {
			this.attachViewToWindow(window, activeTabView);
			this.switchActiveTab(window, activeTabId);
		}

		this.scheduleWindowResize(window);
	}

	initWindowShellView(shellWindowId: number, shellView: WebContentsView) {
		this.windowShellView.set(shellWindowId, shellView);
	}

	getTabById(tabId: string): Tab | undefined {
		return this.tabMap.get(tabId);
	}

	async removeWindowTabs(windowId: number) {
		const windowTabs = await tabStorage.getTabs(windowId.toString());
		if (isNull(windowTabs)) return;
		const window = BrowserWindow.fromId(windowId);
		if (isNull(window)) return;

		// Check each tab and delete private chat data
		for (const tab of windowTabs) {
			if (tab.type === "chat" && tab.threadId) {
				const thread = (await storageService.getItemInternal(
					"app-thread:" + tab.threadId,
				)) as ThreadParmas | null;

				// If this is a private chat, delete all related data
				if (thread?.isPrivateChatActive) {
					console.log(
						`[Privacy] Deleting private chat data for tab ${tab.id}, thread ${tab.threadId}`,
					);
					await storageService.removeItemInternal("app-thread:" + tab.threadId);
					await storageService.removeItemInternal("app-chat-messages:" + tab.threadId);
				}
			}

			this.removeTab(window, tab.id);
		}

		const shellView = this.windowShellView.get(windowId);
		if (!isUndefined(shellView)) {
			shellView.webContents.close();
			this.windowShellView.delete(windowId);
		}

		this.windowTabView.delete(windowId);
		this.windowActiveTabId.delete(windowId);

		// If this is the last window, clean up all preloaded views
		const remainingWindows = BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
		if (remainingWindows.length === 0) {
			console.log("[Preload] Cleaning up all preloaded views (last window closing)");
			for (const [threadId, view] of this.preloadedViewPool.entries()) {
				try {
					if (!view.webContents.isDestroyed()) {
						view.webContents.close({ waitForBeforeUnload: false });
					}
				} catch (error) {
					console.error(`[Preload] Error closing preloaded view for thread ${threadId}:`, error);
				}
			}
			this.preloadedViewPool.clear();
			this.preloadQueue = [];
			this.windowPreloadStatus.clear();
		}
	}

	/**
	 * Cleanup private chat data for all tabs in a window without removing the tabs themselves.
	 * Used when closing the last window to ensure private data is deleted.
	 */
	async cleanupPrivateChatData(windowId: number) {
		const windowTabs = await tabStorage.getTabs(windowId.toString());
		if (isNull(windowTabs)) return;

		console.log(`[Privacy] Cleaning up private chat data for window ${windowId}`);

		const tabsToKeep: Tab[] = [];
		let removedActiveTabIndex = -1;

		// Check each tab and delete private chat data
		for (let i = 0; i < windowTabs.length; i++) {
			const tab = windowTabs[i];
			let isPrivateChat = false;

			if (tab.type === "chat" && tab.threadId) {
				const thread = (await storageService.getItemInternal(
					"app-thread:" + tab.threadId,
				)) as ThreadParmas | null;

				// If this is a private chat, delete all related data
				if (thread?.isPrivateChatActive) {
					console.log(
						`[Privacy] Deleting private chat data for tab ${tab.id}, thread ${tab.threadId}`,
					);
					await storageService.removeItemInternal("app-thread:" + tab.threadId);
					await storageService.removeItemInternal("app-chat-messages:" + tab.threadId);
					isPrivateChat = true;

					// Track if we removed the active tab
					if (tab.active) {
						removedActiveTabIndex = i;
					}
				}
			}

			// Keep non-private tabs
			if (!isPrivateChat) {
				tabsToKeep.push(tab);
			}
		}

		// Update tab storage to remove private tabs
		if (tabsToKeep.length !== windowTabs.length) {
			console.log(
				`[Privacy] Removed ${windowTabs.length - tabsToKeep.length} private tab(s) from storage`,
			);

			// If we removed the active tab, set a new active tab
			if (removedActiveTabIndex !== -1 && tabsToKeep.length > 0) {
				console.log(
					`[Privacy] Removed active tab at index ${removedActiveTabIndex}, reassigning active tab`,
				);

				// Clear all active flags first
				tabsToKeep.forEach((tab) => {
					tab.active = false;
				});

				// Find the appropriate tab to activate
				// Try to find the tab that was after the removed tab
				let newActiveIndex = 0;

				for (let i = 0; i < tabsToKeep.length; i++) {
					// Count how many tabs were before this one in the original list
					const originalTab = tabsToKeep[i];
					const origIndex = windowTabs.findIndex((t) => t.id === originalTab.id);

					if (origIndex > removedActiveTabIndex) {
						// This tab was after the removed tab, use it
						newActiveIndex = i;
						break;
					}

					// If we're at the last tab and haven't found one after, use the last one (the one before)
					if (i === tabsToKeep.length - 1) {
						newActiveIndex = i;
					}
				}

				tabsToKeep[newActiveIndex].active = true;
				console.log(`[Privacy] Set tab at index ${newActiveIndex} as active`);
			}

			// If there are no tabs left, create a new default tab
			if (tabsToKeep.length === 0) {
				console.log(`[Privacy] No tabs left, will create default tab on next launch`);
			}

			await tabStorage.updateWindowTabs(windowId.toString(), tabsToKeep);
		}
	}

	handleWindowResize(window: BrowserWindow) {
		const shellView = this.windowShellView.get(window.id);
		const tabViews = this.windowTabView.get(window.id);
		if (isUndefined(shellView) || isUndefined(tabViews)) return;

		const { width, height } = window.getContentBounds();
		shellView.setBounds({ x: 0, y: 0, width, height });
		tabViews.forEach((view) => {
			view.setBounds({
				x: 0,
				y: TITLE_BAR_HEIGHT + 1,
				width,
				height: height - TITLE_BAR_HEIGHT - 1,
			});
		});
	}

	removeTab(window: BrowserWindow, tabId: string) {
		console.log("Removing Tab --->", tabId);
		const view = this.tabViewMap.get(tabId);
		if (!isUndefined(view)) {
			// Get the thread ID before removing
			const tab = this.tabMap.get(tabId);
			const threadId = tab?.threadId;

			window.contentView.removeChildView(view);

			// IMPORTANT: Check if this view is in the preload pool
			// If it is, don't close it - it will be reused
			const isInPool = Array.from(this.preloadedViewPool.values()).includes(view);
			if (isInPool) {
				console.log(`[Preload] View for tab ${tabId} (thread ${threadId}) is in pool, not closing`);
			} else {
				// Not in pool, safe to close
				view.webContents.close({ waitForBeforeUnload: true });
			}
		} else {
			this.tabViewMap.delete(tabId);
			this.tabMap.delete(tabId);
		}
	}

	async addTabToWindow(window: BrowserWindow, tab: Tab): Promise<void> {
		console.log("Adding Tab to Window --->", tab.id, "to window", window.id);

		// Create view for the tab
		const view = await this.newWebContentsView(window.id, tab);

		// Attach view to window
		this.attachViewToWindow(window, view);

		// Add to tab map
		this.tabMap.set(tab.id, tab);

		// Add to window's view list
		const windowViews = this.windowTabView.get(window.id) || [];
		if (!windowViews.includes(view)) {
			windowViews.push(view);
			this.windowTabView.set(window.id, windowViews);
		}

		// Switch to this tab
		this.switchActiveTab(window, tab.id);

		this.scheduleWindowResize(window);
	}

	/**
	 * Transfer a tab from one window to another while preserving the WebContentsView
	 */
	transferTabToWindow(
		fromWindow: BrowserWindow,
		toWindow: BrowserWindow,
		tabId: string,
		tab: Tab,
	): void {
		console.log(`Transferring Tab ${tabId} from window ${fromWindow.id} to window ${toWindow.id}`);

		const view = this.tabViewMap.get(tabId);
		if (isUndefined(view)) return;

		// Remove view from source window
		fromWindow.contentView.removeChildView(view);

		// Remove from source window's view list
		const fromWindowViews = this.windowTabView.get(fromWindow.id);
		if (!isUndefined(fromWindowViews)) {
			const updatedFromViews = fromWindowViews.filter((v) => v !== view);
			this.windowTabView.set(fromWindow.id, updatedFromViews);
		}

		// Remove from source window's active tab if it was active
		const activeTabId = this.windowActiveTabId.get(fromWindow.id);
		if (activeTabId === tabId) {
			this.windowActiveTabId.delete(fromWindow.id);
		}

		// Update window ID in WebContents to fix state management issues
		view.webContents
			.executeJavaScript(
				`
			window.windowId = "${toWindow.id}";
			// Trigger TabBarState to refresh window ID
			if (window.dispatchEvent) {
				window.dispatchEvent(new CustomEvent('windowIdChanged', {
					detail: { newWindowId: "${toWindow.id}" }
				}));
			}
		`,
			)
			.catch((error) => {
				console.error(`Failed to update window ID for tab ${tabId}:`, error);
			});

		// Add to target window
		this.attachViewToWindow(toWindow, view);

		// Update tab data
		this.tabMap.set(tabId, tab);

		// Add to target window's view list
		const toWindowViews = this.windowTabView.get(toWindow.id) || [];
		toWindowViews.push(view);
		this.windowTabView.set(toWindow.id, toWindowViews);

		// Switch to this tab in target window
		this.switchActiveTab(toWindow, tabId);
	}

	focusTabInWindow(window: BrowserWindow, tabId: string): void {
		if (window.isDestroyed()) return;

		const view = this.tabViewMap.get(tabId);
		if (isUndefined(view)) return;

		// Ensure the view is attached to the window and visible
		if (view.webContents.isDestroyed()) {
			this.tabViewMap.delete(tabId);
			this.tabMap.delete(tabId);
			return;
		}

		window.contentView.removeChildView(view);
		window.contentView.addChildView(view);

		this.switchActiveTab(window, tabId);

		view.webContents.focus();
	}

	// ******************************* IPC Methods ******************************* //
	async handleNewTabWithThread(
		event: IpcMainInvokeEvent,
		threadId: string,
		title: string = "Chat",
		type: TabType = "chat",
		active: boolean = true,
	): Promise<string | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;

		const { getHref } = getTabConfig(type);
		const newTabId = nanoid();
		const newTab: Tab = {
			id: newTabId,
			title,
			href: getHref(newTabId),
			type,
			active,
			threadId,
		};

		// Try to use preloaded view for existing threads
		const view = await this.getOrCreateViewForThread(window.id, threadId, newTab);
		this.attachViewToWindow(window, view);
		this.switchActiveTab(window, newTab.id);

		this.tabMap.set(newTab.id, newTab);

		const windowViews = this.windowTabView.get(window.id) || [];
		if (!windowViews.includes(view)) {
			windowViews.push(view);
			this.windowTabView.set(window.id, windowViews);
		}

		this.scheduleWindowResize(window);

		return stringify(newTab);
	}

	async handleNewTab(
		event: IpcMainInvokeEvent,
		title: string = "New Chat",
		type: TabType = "chat",
		active: boolean = true,
		href?: string,
	): Promise<string | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;

		const { title: tabTitle, getHref } = getTabConfig(type);
		const newTabId = nanoid();
		const newThreadId = nanoid();
		const newTab: Tab = {
			id: newTabId,
			title: title ?? tabTitle,
			href: href ?? getHref(newTabId),
			type,
			active,
			threadId: newThreadId,
		};

		if (type === "chat") {
			const preferencesSettings = (await storageService.getItemInternal(
				"PreferencesSettingsStorage:state",
			)) as unknown as { newSessionModel?: ThreadParmas["selectedModel"] } | null;

			const generalSettings = (await storageService.getItemInternal(
				"GeneralSettingsStorage:state",
			)) as unknown as { privacyAutoInherit?: boolean } | null;

			// Get current active tab's privacy state if privacyAutoInherit is enabled
			let inheritedPrivacyState = false;
			if (generalSettings?.privacyAutoInherit) {
				const activeTabId = this.windowActiveTabId.get(window.id);
				if (activeTabId) {
					const activeTab = this.tabMap.get(activeTabId);
					if (activeTab?.threadId) {
						const activeThread = (await storageService.getItemInternal(
							"app-thread:" + activeTab.threadId,
						)) as ThreadParmas | null;
						if (activeThread) {
							inheritedPrivacyState = activeThread.isPrivateChatActive;
						}
					}
				}
			}

			const newThread: ThreadParmas = {
				id: newThreadId,
				title: title,
				temperature: null,
				topP: null,
				frequencyPenalty: null,
				presencePenalty: null,
				maxTokens: null,
				inputValue: "",
				attachments: [],
				mcpServers: [],
				mcpServerIds: [],
				isThinkingActive: false,
				isOnlineSearchActive: false,
				isMCPActive: false,
				selectedModel: preferencesSettings?.newSessionModel ?? null,
				isPrivateChatActive: inheritedPrivacyState,
				updatedAt: new Date(),
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const newMessages: any = [];
			await storageService.setItemInternal("app-thread:" + newTab.threadId, newThread);
			await storageService.setItemInternal("app-chat-messages:" + newTab.threadId, newMessages);
		}

		const view = await this.newWebContentsView(window.id, newTab);
		this.attachViewToWindow(window, view);
		this.switchActiveTab(window, newTab.id);

		this.tabMap.set(newTab.id, newTab);

		const windowViews = this.windowTabView.get(window.id) || [];
		if (!windowViews.includes(view)) {
			windowViews.push(view);
			this.windowTabView.set(window.id, windowViews);
		}

		this.scheduleWindowResize(window);

		return stringify(newTab);
	}

	async handleActivateTab(event: IpcMainInvokeEvent, tabId: string) {
		const view = this.tabViewMap.get(tabId);
		if (isUndefined(view)) return;

		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		window.contentView.removeChildView(view);
		window.contentView.addChildView(view);
		this.switchActiveTab(window, tabId);
	}

	async getActiveTab(event: IpcMainInvokeEvent): Promise<Tab | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;
		const [tabs, activeTabId] = await Promise.all([
			tabStorage.getTabs(window.id.toString()),
			tabStorage.getActiveTabId(window.id.toString()),
		]);

		if (isNull(tabs) || isNull(activeTabId)) return null;

		const tab = tabs.find((tab) => tab.id === activeTabId);
		if (isUndefined(tab)) return null;

		return tab;
	}

	async handleTabClose(event: IpcMainInvokeEvent, tabId: string, newActiveTabId: string | null) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		const view = this.tabViewMap.get(tabId);
		if (isUndefined(view)) return;

		if (newActiveTabId && this.windowActiveTabId.get(window.id) === tabId) {
			this.switchActiveTab(window, newActiveTabId);
		}

		// Check if this tab is a private chat and delete its data
		const tab = this.tabMap.get(tabId);
		if (tab?.type === "chat" && tab.threadId) {
			const thread = (await storageService.getItemInternal(
				"app-thread:" + tab.threadId,
			)) as ThreadParmas | null;

			if (thread?.isPrivateChatActive) {
				console.log(
					`[Privacy] Deleting private chat data for tab ${tabId}, thread ${tab.threadId}`,
				);
				await storageService.removeItemInternal("app-thread:" + tab.threadId);
				await storageService.removeItemInternal("app-chat-messages:" + tab.threadId);
			}
		}

		this.removeTab(window, tabId);
	}

	async handleTabCloseOthers(event: IpcMainInvokeEvent, tabId: string, tabIdsToClose: string[]) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		this.switchActiveTab(window, tabId);

		// Check each tab and delete private chat data before removing
		for (const tabIdToClose of tabIdsToClose) {
			const tab = this.tabMap.get(tabIdToClose);
			if (tab?.type === "chat" && tab.threadId) {
				const thread = (await storageService.getItemInternal(
					"app-thread:" + tab.threadId,
				)) as ThreadParmas | null;

				if (thread?.isPrivateChatActive) {
					console.log(
						`[Privacy] Deleting private chat data for tab ${tabIdToClose}, thread ${tab.threadId}`,
					);
					await storageService.removeItemInternal("app-thread:" + tab.threadId);
					await storageService.removeItemInternal("app-chat-messages:" + tab.threadId);
				}
			}

			this.removeTab(window, tabIdToClose);
		}
	}

	async handleTabCloseOffside(
		event: IpcMainInvokeEvent,
		tabId: string,
		tabIdsToClose: string[],
		_remainingTabIds: string[],
		shouldSwitchActive: boolean,
	) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		if (shouldSwitchActive) {
			this.switchActiveTab(window, tabId);
		}

		// Check each tab and delete private chat data before removing
		for (const tabIdToClose of tabIdsToClose) {
			const tab = this.tabMap.get(tabIdToClose);
			if (tab?.type === "chat" && tab.threadId) {
				const thread = (await storageService.getItemInternal(
					"app-thread:" + tab.threadId,
				)) as ThreadParmas | null;

				if (thread?.isPrivateChatActive) {
					console.log(
						`[Privacy] Deleting private chat data for tab ${tabIdToClose}, thread ${tab.threadId}`,
					);
					await storageService.removeItemInternal("app-thread:" + tab.threadId);
					await storageService.removeItemInternal("app-chat-messages:" + tab.threadId);
				}
			}

			this.removeTab(window, tabIdToClose);
		}
	}

	async handleTabCloseAll(event: IpcMainInvokeEvent) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		this.windowActiveTabId.delete(window.id);

		const windowViews = this.windowTabView.get(window.id);
		if (!isUndefined(windowViews)) {
			windowViews.forEach((view) => {
				window.contentView.removeChildView(view);
				view.webContents.close();
			});
		}
		this.windowTabView.delete(window.id);
	}

	async handleShellViewLevel(event: IpcMainInvokeEvent, up: boolean) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;
		const shellView = this.windowShellView.get(window.id);
		if (isUndefined(shellView)) return;

		const handleShellViewLevel = (view: WebContentsView) => {
			if (!isMac) {
				window.contentView.removeChildView(view);
			}
			window.contentView.addChildView(view);
			view.webContents.focus();
		};

		if (up) {
			handleShellViewLevel(shellView);
		} else {
			const activeTabId = this.windowActiveTabId.get(window.id);
			if (isUndefined(activeTabId)) return;
			const activeTabView = this.tabViewMap.get(activeTabId);
			if (isUndefined(activeTabView)) return;

			handleShellViewLevel(activeTabView);
		}
	}

	// ******************************* Shortcut Helper Methods ******************************* //
	getWindowTabs(windowId: number): Map<string, Tab> {
		const windowViews = this.windowTabView.get(windowId);
		const tabs = new Map<string, Tab>();
		if (windowViews) {
			windowViews.forEach((view) => {
				this.tabMap.forEach((tab, tabId) => {
					const tabView = this.tabViewMap.get(tabId);
					if (tabView === view) {
						tabs.set(tabId, tab);
					}
				});
			});
		}
		return tabs;
	}

	getActiveTabId(windowId: number): string | undefined {
		return this.windowActiveTabId.get(windowId);
	}

	getTabView(tabId: string): WebContentsView | undefined {
		return this.tabViewMap.get(tabId);
	}

	getShellView(windowId: number): WebContentsView | undefined {
		return this.windowShellView.get(windowId);
	}

	selectTab(windowId: number, tabId: string): void {
		const window = BrowserWindow.fromId(windowId);
		if (!window) return;
		this.switchActiveTab(window, tabId);
	}

	/**
	 * Replace the current tab's thread content with a new thread
	 * This uses preloaded views when available for instant switching
	 * The old view is returned to the preload pool instead of being destroyed
	 */
	async replaceTabContent(
		event: IpcMainInvokeEvent,
		tabId: string,
		newThreadId: string,
	): Promise<boolean> {
		console.log(`[replaceTabContent] Replacing tab ${tabId} with thread ${newThreadId}`);

		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) {
			console.error("[replaceTabContent] Window not found");
			return false;
		}

		const oldView = this.tabViewMap.get(tabId);
		if (isUndefined(oldView) || oldView.webContents.isDestroyed()) {
			console.error("[replaceTabContent] View not found or destroyed");
			return false;
		}

		try {
			const threadData = await storageService.getItemInternal("app-thread:" + newThreadId);

			if (!threadData || typeof threadData !== "object" || !("title" in threadData)) {
				console.error(`[replaceTabContent] Thread ${newThreadId} not found in storage`);
				return false;
			}

			const currentTab = this.tabMap.get(tabId);
			if (isUndefined(currentTab)) {
				console.error("[replaceTabContent] Current tab not found in tabMap");
				return false;
			}

			const oldThreadId = currentTab.threadId;

			const updatedTab = {
				...currentTab,
				threadId: newThreadId,
				title: threadData.title as string,
			};

			// Remove old view from window and hide it
			window.contentView.removeChildView(oldView);
			oldView.setVisible(false);

			// Remove old mappings
			this.tabViewMap.delete(tabId);
			this.tabMap.delete(tabId);

			// Return old view to preload pool if it's a valid thread
			if (oldThreadId && !this.preloadedViewPool.has(oldThreadId)) {
				console.log(`[Preload] Returning view for thread ${oldThreadId} to pool`);
				this.preloadedViewPool.set(oldThreadId, oldView);
			}

			// Try to get preloaded view or create new one
			const newView = await this.getOrCreateViewForThread(window.id, newThreadId, updatedTab);

			// IMPORTANT: Ensure tabMap is updated with the new tab
			// This is critical when newWebContentsView creates a new view (not from preload pool)
			// because newWebContentsView only sets tabViewMap, not tabMap
			this.tabMap.set(tabId, updatedTab);

			// Update window views list
			const windowViews = this.windowTabView.get(window.id);
			if (!isUndefined(windowViews)) {
				const viewIndex = windowViews.indexOf(oldView);
				if (viewIndex !== -1) {
					windowViews[viewIndex] = newView;
				} else {
					windowViews.push(newView);
				}
			}

			// Attach new view to window and activate it
			this.attachViewToWindow(window, newView);
			this.switchActiveTab(window, tabId);

			return true;
		} catch (error) {
			console.error(`[replaceTabContent] Failed to replace tab content:`, error);
			return false;
		}
	}

	/**
	 * Clear messages for a specific tab by reloading its WebContentsView
	 */
	async handleClearTabMessages(
		_event: IpcMainInvokeEvent,
		tabId: string,
		threadId: string,
	): Promise<boolean> {
		console.log(`[handleClearTabMessages] Clearing messages for tab ${tabId}, thread ${threadId}`);

		try {
			// Clear messages in storage
			await storageService.setItemInternal(`app-chat-messages:${threadId}`, []);

			// Get the tab's WebContentsView
			const view = this.tabViewMap.get(tabId);
			if (isUndefined(view) || view.webContents.isDestroyed()) {
				console.warn(`[handleClearTabMessages] View not found or destroyed for tab ${tabId}`);
				return true; // Storage was cleared, which is the main goal
			}

			// Send a message to the tab to clear its in-memory state
			view.webContents.send("tab:clear-messages", { tabId, threadId });

			return true;
		} catch (error) {
			console.error(`[handleClearTabMessages] Failed to clear messages:`, error);
			return false;
		}
	}

	/**
	 * Generate title for a specific tab
	 */
	async handleGenerateTabTitle(
		_event: IpcMainInvokeEvent,
		tabId: string,
		threadId: string,
	): Promise<boolean> {
		console.log(`[handleGenerateTabTitle] Generating title for tab ${tabId}, thread ${threadId}`);

		try {
			// Get the tab's WebContentsView
			const view = this.tabViewMap.get(tabId);
			if (isUndefined(view) || view.webContents.isDestroyed()) {
				console.warn(`[handleGenerateTabTitle] View not found or destroyed for tab ${tabId}`);
				return false;
			}

			// Send a message to the tab to generate title
			view.webContents.send("tab:generate-title", { tabId, threadId });

			return true;
		} catch (error) {
			console.error(`[handleGenerateTabTitle] Failed to generate title:`, error);
			return false;
		}
	}

	/**
	 * Start preloading all threads for a window
	 * This is called from the frontend after the main UI has loaded
	 */
	async startPreloadThreads(event: IpcMainInvokeEvent): Promise<void> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) {
			console.error("[startPreloadThreads] Window not found");
			return;
		}

		console.log(`[startPreloadThreads] Starting preload for window ${window.id}`);
		await this.preloadAllThreads(window.id);
	}
}

export const tabService = new TabService();
