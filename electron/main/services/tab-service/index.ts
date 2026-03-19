import { MAX_TABS_PER_WINDOW } from "@shared/constants/tab";
import type { ChatMessage, Tab, TabType, ThreadParmas } from "@shared/types";
import { BrowserWindow, ipcMain, WebContentsView, type IpcMainInvokeEvent } from "electron";
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
import { emitter } from "../broadcast-service";
import { shortcutService } from "../shortcut-service";
import { storageService } from "../storage-service";
import { providerStorage } from "../storage-service/provider-storage";
import { sessionStorage } from "../storage-service/session-storage";
import { tabStorage } from "../storage-service/tab-storage";
import { threadStorage } from "../storage-service/thread-storage";
import { threadStateService } from "../thread-state-service";
import { LRUTabManager, type TabUsageMetrics } from "./lru-tab-manager";
import { MemoryManager } from "./memory-manager";
import { createElectronSnapshotProvider } from "./memory-snapshot";
import { ViewLoadTracker } from "./view-load-tracker";

type TabConfig = {
	title: string;
	getHref: (id: string) => string;
};

const TAB_CONFIGS: Record<TabType, TabConfig> = {
	chat: { title: "New Chat", getHref: (id) => `/chat/${id}` },
	settings: { title: "Settings", getHref: () => "/settings/general-settings" },
	aiApplications: { title: "AI Applications", getHref: () => "/ai-applications" },
	codeAgent: { title: "Code Agent", getHref: () => "/code-agent" },
	htmlPreview: { title: "HTML Preview", getHref: (id) => `/html-preview/${id}` },
	helpDocs: { title: "Help Docs", getHref: () => "https://studio.302.ai/zh/docs" },
	skillsHub: { title: "302 Skills Hub", getHref: () => "https://skills.302.ai" },
	openClawWebUi: { title: "OpenClaw WebUI", getHref: () => "about:blank" },
} as const;

const getTabConfig = (type: TabType) => TAB_CONFIGS[type] || TAB_CONFIGS.chat;

interface TabAccessInfo {
	lastAccessTime: number;
	isBusy: boolean;
}

export class TabService {
	private tabViewMap: Map<string, WebContentsView>;
	private tabMap: Map<string, Tab>;
	private windowTabView: Map<number, WebContentsView[]>;
	private windowActiveTabId: Map<number, string>;
	private windowShellView: Map<number, WebContentsView>;
	private tempFileRegistry: Map<string, string[]>; // tabId -> tempFilePaths[]
	private tabAccessHistory: Map<string, TabAccessInfo>;
	private tabWindowMap: Map<string, number>; // tabId -> windowId
	private pendingDestroyTabs: Set<string>;
	private pendingDestroyTimers: Map<string, NodeJS.Timeout>;
	private memoryManager: MemoryManager;
	private memoryManagerStarted: boolean;
	private initialLoadTracker: ViewLoadTracker;

	constructor() {
		this.tabViewMap = new Map();
		this.tabMap = new Map();
		this.windowTabView = new Map();
		this.windowActiveTabId = new Map();
		this.windowShellView = new Map();
		this.tempFileRegistry = new Map();
		this.tabAccessHistory = new Map();
		this.tabWindowMap = new Map();
		this.pendingDestroyTabs = new Set();
		this.pendingDestroyTimers = new Map();
		this.memoryManager = new MemoryManager({ getSnapshot: createElectronSnapshotProvider() });
		this.memoryManagerStarted = false;
		this.initialLoadTracker = new ViewLoadTracker();

		// Listen for thread busy state changes to handle pending destructions
		emitter.on(
			"thread-busy-state-changed",
			(data: { threadId: string; isBusy: boolean; reason?: string }) => {
				if (!data.isBusy) {
					this.checkPendingDestruction(data.threadId);
				}
			},
		);
	}

	async startMemoryManagerAfterInitialLoad(timeoutMs: number = 10_000) {
		if (this.memoryManagerStarted) return;

		await this.initialLoadTracker.waitForAll(timeoutMs);
		this.startMemoryManager();
	}

	private startMemoryManager() {
		if (this.memoryManagerStarted) return;
		this.memoryManagerStarted = true;
		this.memoryManager.start(() => this.checkAndSleepTabs());
		this.memoryManager.requestImmediateCheck();
	}

	private trackInitialViewLoad(view: WebContentsView) {
		if (this.memoryManagerStarted) return;
		this.initialLoadTracker.track(view);
	}

	private requestMemoryCheckOnNewView() {
		if (!this.memoryManagerStarted) return;
		this.memoryManager.requestImmediateCheck();
	}

	private async checkAndSleepTabs() {
		const windows = BrowserWindow.getAllWindows();
		const focusedWindow = BrowserWindow.getFocusedWindow();

		for (const window of windows) {
			if (window.isDestroyed()) continue;

			const isFocused = focusedWindow && window.id === focusedWindow.id;
			const maxBackgroundTabs = isFocused ? 10 : 5;

			const activeTabId = this.windowActiveTabId.get(window.id);
			const views = this.windowTabView.get(window.id) || [];
			const metrics: TabUsageMetrics[] = [];

			for (const view of views) {
				let tabId: string | undefined;
				for (const [id, v] of this.tabViewMap.entries()) {
					if (v === view) {
						tabId = id;
						break;
					}
				}

				if (tabId) {
					const tab = this.tabMap.get(tabId);
					const isThreadBusy = tab?.threadId
						? threadStateService.isThreadBusy(tab.threadId)
						: false;

					const access = this.tabAccessHistory.get(tabId) || {
						lastAccessTime: 0,
						isBusy: false,
					};
					metrics.push({
						tabId,
						lastAccessTime: access.lastAccessTime,
						isBusy: isThreadBusy,
						isActive: tabId === activeTabId,
					});
				}
			}

			const tabsToSleep = LRUTabManager.calculateEvictions(metrics, maxBackgroundTabs);

			for (const tabId of tabsToSleep) {
				await this.sleepTab(tabId);
			}
		}
	}

	private checkPendingDestruction(threadId: string) {
		// Find if any pending destroy tab belongs to this thread
		for (const tabId of this.pendingDestroyTabs) {
			const tab = this.tabMap.get(tabId);
			if (tab && tab.threadId === threadId) {
				console.log(
					`[TabService] Thread ${threadId} is no longer busy, executing pending destruction for tab ${tabId}`,
				);

				// Cancel any existing timer for this tab to prevent duplicates
				const existingTimer = this.pendingDestroyTimers.get(tabId);
				if (existingTimer) {
					clearTimeout(existingTimer);
				}

				// Use a small delay to ensure frontend persistence is complete
				const timer = setTimeout(() => {
					this.pendingDestroyTimers.delete(tabId);
					this.forceDestroyTab(tabId);
				}, 5000);
				this.pendingDestroyTimers.set(tabId, timer);
			}
		}
	}

	private forceDestroyTab(tabId: string) {
		// Guard: if tab was resurrected, it's no longer in pendingDestroyTabs — skip destruction
		if (!this.pendingDestroyTabs.has(tabId)) {
			console.log(
				`[TabService] Tab ${tabId} is no longer pending destruction (resurrected?), skipping`,
			);
			return;
		}

		this.pendingDestroyTabs.delete(tabId);
		this.pendingDestroyTimers.delete(tabId);
		const view = this.tabViewMap.get(tabId);
		if (view && !view.webContents.isDestroyed()) {
			console.log(`[TabService] Force destroying tab ${tabId}`);
			view.webContents.close({ waitForBeforeUnload: false });
		} else {
			// Cleanup maps if view is already gone
			console.log(`[TabService] Cleaning up metadata for already destroyed tab ${tabId}`);
			this.tabViewMap.delete(tabId);
			this.tabMap.delete(tabId);
			this.tabWindowMap.delete(tabId);
		}
	}

	/**
	 * Attempt to resurrect a tab that is pending destruction for a specific thread.
	 * If found, it re-attaches the view to the target window and restores its state.
	 */
	private async resurrectTab(targetWindow: BrowserWindow, threadId: string): Promise<Tab | null> {
		let pendingTabId: string | undefined;

		// 1. Search in pending list
		for (const tabId of this.pendingDestroyTabs) {
			const tab = this.tabMap.get(tabId);
			if (tab && tab.threadId === threadId) {
				pendingTabId = tabId;
				break;
			}
		}

		if (!pendingTabId) return null;

		const tab = this.tabMap.get(pendingTabId);
		const view = this.tabViewMap.get(pendingTabId);

		if (!tab || !view || view.webContents.isDestroyed()) {
			this.pendingDestroyTabs.delete(pendingTabId); // Cleanup invalid entry
			return null;
		}

		console.log(
			`[TabService] Resurrecting pending tab ${pendingTabId} for thread ${threadId} into window ${targetWindow.id}`,
		);

		// 2. Remove from pending list (Rescue it)
		this.pendingDestroyTabs.delete(pendingTabId);

		// 3. Cancel any pending destruction timer
		const pendingTimer = this.pendingDestroyTimers.get(pendingTabId);
		if (pendingTimer) {
			clearTimeout(pendingTimer);
			this.pendingDestroyTimers.delete(pendingTabId);
			console.log(
				`[TabService] Cancelled pending destruction timer for resurrected tab ${pendingTabId}`,
			);
		}

		// 4. Update Window Mapping
		const oldWindowId = this.tabWindowMap.get(pendingTabId);
		this.tabWindowMap.set(pendingTabId, targetWindow.id);

		// 5. Handle Cross-Window migration if necessary
		if (oldWindowId !== targetWindow.id) {
			// Update renderer's window context
			view.webContents
				.executeJavaScript(
					`
				window.windowId = "${targetWindow.id}";
				if (window.dispatchEvent) {
					window.dispatchEvent(new CustomEvent('windowIdChanged', {
						detail: { newWindowId: "${targetWindow.id}" }
					}));
				}
			`,
				)
				.catch((err) => console.error("Failed to update windowId during resurrection:", err));

			// Rebind shortcuts
			shortcutService.getEngine().attachToView(view, targetWindow.id, pendingTabId);
		}

		// 6. Re-attach View
		this.attachViewToWindow(targetWindow, view);

		// 7. Add to Window Views list
		const views = this.windowTabView.get(targetWindow.id) || [];
		if (!views.includes(view)) {
			views.push(view);
			this.windowTabView.set(targetWindow.id, views);
		}

		// 8. Update Storage (Add it back to UI)
		// We do this BEFORE switchActiveTab to ensure state consistency
		const windowIdStr = targetWindow.id.toString();
		const tabState = await tabStorage.getItemInternal("tab-bar-state");
		if (!isNull(tabState)) {
			const currentTabs = tabState[windowIdStr]?.tabs || [];
			// Mark as active
			const restoredTab = { ...tab, active: true };
			const updatedTabs = [...currentTabs.map((t) => ({ ...t, active: false })), restoredTab];
			tabState[windowIdStr] = { tabs: updatedTabs };
			await tabStorage.setItemInternal("tab-bar-state", tabState);
		}

		// 9. Finally switch focus
		await this.switchActiveTab(targetWindow, pendingTabId);

		return tab;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private async getSnapshotFromRenderer(view: WebContentsView, tabId: string): Promise<any> {
		return new Promise((resolve) => {
			const cleanup = () => {
				ipcMain.removeListener("tab:snapshot-data", listener);
				clearTimeout(timeout);
			};

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const listener = (event: any, snapshot: any) => {
				if (event.sender.id === view.webContents.id) {
					cleanup();
					resolve(snapshot);
				}
			};

			ipcMain.on("tab:snapshot-data", listener);

			// Request snapshot
			view.webContents.send("tab:request-snapshot");

			// Timeout after 500ms (we don't want to block sleep too long)
			const timeout = setTimeout(() => {
				console.warn(`[TabService] Snapshot timeout for tab ${tabId}`);
				cleanup();
				resolve(null);
			}, 500);
		});
	}

	private async sleepTab(tabId: string) {
		console.log(`[TabService] Sleeping tab ${tabId}`);
		const view = this.tabViewMap.get(tabId);
		const tab = this.tabMap.get(tabId);

		if (!view || !tab) return;
		if (view.webContents.isDestroyed()) return;

		// 1. Snapshot UI state
		try {
			// Request snapshot from renderer via IPC
			const uiState = await this.getSnapshotFromRenderer(view, tabId);

			if (uiState) {
				tab.uiState = uiState;
				console.log(`[TabService] Captured UI state for tab ${tabId}`, uiState);
			}

			tab.isSleeping = true;
			this.tabMap.set(tabId, tab);

			// Update storage so state persists across restarts (optional but good)
			// We need to find which window this tab belongs to to update storage
			// This is expensive, so maybe skip for now or do it efficiently
		} catch (error) {
			console.error(`[TabService] Failed to snapshot tab ${tabId}:`, error);
		}

		// 2. Remove view from window
		const window = this.findWindowForTab(tabId);
		if (window) {
			window.contentView.removeChildView(view);
			// Remove from windowTabView list
			const views = this.windowTabView.get(window.id) || [];
			const updatedViews = views.filter((v) => v !== view);
			this.windowTabView.set(window.id, updatedViews);
		}

		// 3. Destroy WebContents
		view.webContents.close({ waitForBeforeUnload: true });
		this.tabViewMap.delete(tabId);
		// Note: We keep tab in tabMap
	}

	private async wakeTab(
		window: BrowserWindow,
		tabId: string,
	): Promise<WebContentsView | undefined> {
		const tab = this.tabMap.get(tabId);
		if (!tab) return undefined;

		console.log(`[TabService] Waking tab ${tabId}`);
		tab.isSleeping = false;
		// Recreate view
		const view = await this.newWebContentsView(window.id, tab);

		// Add to window views list
		const views = this.windowTabView.get(window.id) || [];
		views.push(view);
		this.windowTabView.set(window.id, views);

		return view;
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

		if (
			tab.type === "aiApplications" ||
			tab.type === "helpDocs" ||
			tab.type === "skillsHub" ||
			tab.type === "openClawWebUi"
		) {
			view = WebContentsFactory.createAiApplicationView({
				windowId,
				type: "aiApplication",
			});
		} else {
			const [thread, messages, codeAgentConfig, claudeCodeAgentState, openclawConfig] =
				await Promise.all([
					storageService.getItemInternal("app-thread:" + tab.threadId),
					storageService.getItemInternal("app-chat-messages:" + tab.threadId),
					storageService.getItemInternal(
						`CodeAgentStorage:code-agent-config-state-${tab.threadId}`,
					),
					storageService.getItemInternal(
						`CodeAgentStorage:claude-code-agent-state-${tab.threadId}`,
					),
					storageService.getItemInternal(`OpenClawStorage:openclaw-config-state-${tab.threadId}`),
				]);

			const threadFilePath = TempStorage.writeData(thread, "thread");
			const messagesFilePath = TempStorage.writeData(messages, "messages");
			const codeAgentConfigFilePath = TempStorage.writeData(codeAgentConfig, "code-agent-config");
			const claudeCodeAgentStateFilePath = TempStorage.writeData(
				claudeCodeAgentState,
				"claude-code-agent-state",
			);

			const openclawConfigFilePath = TempStorage.writeData(openclawConfig, "openclaw-config");

			// Create view using factory
			view = WebContentsFactory.createTabView({
				windowId,
				type: "tab",
				tab,
				threadFilePath,
				messagesFilePath,
				codeAgentConfigFilePath,
				claudeCodeAgentStateFilePath,
				openclawConfigFilePath,
			});
		}

		// Add devTools shortcuts
		withDevToolsShortcuts(view);
		withLoadHandlers(view, {
			baseUrl:
				tab.type === "aiApplications" ||
				tab.type === "helpDocs" ||
				tab.type === "skillsHub" ||
				tab.type === "openClawWebUi"
					? tab.href
					: MAIN_WINDOW_VITE_DEV_SERVER_URL || "app://localhost",
			// autoOpenDevTools: !!MAIN_WINDOW_VITE_DEV_SERVER_URL,
		});

		this.trackInitialViewLoad(view);
		this.requestMemoryCheckOnNewView();

		// Attach shortcut engine to tab view
		shortcutService.getEngine().attachToView(view, windowId, tab.id);

		this.tabViewMap.set(tab.id, view);

		// Add lifecycle handlers
		const capturedTabId = tab.id;
		const capturedWindowId = windowId;
		// Capture tab data for business cleanup in onDestroyed
		const capturedTab = tab;
		withLifecycleHandlers(view, {
			onDestroyed: async () => {
				// Prevent old view from deleting data when a new view was created by wakeTab
				const activeView = this.tabViewMap.get(capturedTabId);
				if (activeView && activeView !== view) {
					console.log(
						`[TabService] Tab ${capturedTabId} old webContents destroyed, but a new view is already active. Skipping cleanup.`,
					);
					return;
				}

				const currentTab = this.tabMap.get(capturedTabId);
				if (currentTab?.isSleeping) {
					console.log(
						`Tab ${capturedTabId} is sleeping, preserving metadata but cleaning view maps`,
					);
					this.tabViewMap.delete(capturedTabId);
					return;
				}

				console.log(`Tab ${capturedTabId} webContents destroyed, cleaning up all mappings`);

				// === Business cleanup: handle private chat and empty thread data ===
				await this.performTabBusinessCleanup(capturedTab);

				// === Technical cleanup: remove mappings ===
				this.tabViewMap.delete(capturedTabId);
				this.tabMap.delete(capturedTabId);
				this.tabWindowMap.delete(capturedTabId);

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

				console.log(`Tab ${capturedTabId} cleanup completed`);
			},
			onWillPreventUnload: () => {
				console.log("view will prevent unload");
			},
		});

		return view;
	}

	/**
	 * Perform business cleanup for a tab (e.g. deleting private chat data or empty threads)
	 */
	private async performTabBusinessCleanup(tab: Tab) {
		if (tab.threadId) {
			// Parallel query for thread and messages
			const [thread, messages] = await Promise.all([
				storageService.getItemInternal(
					`app-thread:${tab.threadId}`,
				) as Promise<ThreadParmas | null>,
				storageService.getItemInternal(`app-chat-messages:${tab.threadId}`) as Promise<
					ChatMessage[] | null
				>,
			]);

			if (thread?.isPrivateChatActive || messages?.length === 0) {
				console.log(`[TabService] Cleaning up business data for thread ${tab.threadId}`);
				// Use unified cleanup method from ThreadStorage
				await threadStorage.cleanupThreadData(tab.threadId);
			}
		}
	}

	private attachViewToWindow(window: BrowserWindow, view: WebContentsView) {
		window.contentView.addChildView(view);
		const { width, height } = window.getContentBounds();
		view.setBounds({ x: 0, y: TITLE_BAR_HEIGHT + 1, width, height: height - TITLE_BAR_HEIGHT - 1 });
	}

	private async switchActiveTab(window: BrowserWindow, newActiveTabId: string) {
		const activeTabId = this.windowActiveTabId.get(window.id);
		if (!isUndefined(activeTabId)) {
			const prevView = this.tabViewMap.get(activeTabId);
			if (prevView) {
				prevView.setVisible(false);
			}
		}

		let newView = this.tabViewMap.get(newActiveTabId);

		// Check if tab needs waking
		if (!newView) {
			const tab = this.tabMap.get(newActiveTabId);
			if (tab?.isSleeping) {
				newView = await this.wakeTab(window, newActiveTabId);
				if (newView) {
					this.attachViewToWindow(window, newView);
					// Ensure it's correctly sized
					const { width, height } = window.getContentBounds();
					newView.setBounds({
						x: 0,
						y: TITLE_BAR_HEIGHT + 1,
						width,
						height: height - TITLE_BAR_HEIGHT - 1,
					});
				}
			}
		}

		if (!isUndefined(newView) && newView !== null) {
			newView.setVisible(true);
			newView.webContents.focus();
		}

		this.windowActiveTabId.set(window.id, newActiveTabId);

		// Update access history
		const accessInfo = this.tabAccessHistory.get(newActiveTabId) || {
			lastAccessTime: 0,
			isBusy: false,
		};
		accessInfo.lastAccessTime = Date.now();
		this.tabAccessHistory.set(newActiveTabId, accessInfo);
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
			this.tabWindowMap.set(tab.id, window.id);
			views.push(tabView);
		}

		this.windowTabView.set(window.id, views);

		if (activeTabView && activeTabId) {
			this.attachViewToWindow(window, activeTabView);
			await this.switchActiveTab(window, activeTabId);
		}

		this.scheduleWindowResize(window);
	}

	initWindowShellView(shellWindowId: number, shellView: WebContentsView) {
		this.windowShellView.set(shellWindowId, shellView);
		this.trackInitialViewLoad(shellView);
	}

	getTabById(tabId: string): Tab | undefined {
		return this.tabMap.get(tabId);
	}

	async removeWindowTabs(windowId: number) {
		const windowTabs = await tabStorage.getTabsByWindowId(windowId.toString());
		if (isNull(windowTabs)) return;
		const window = BrowserWindow.fromId(windowId);
		if (isNull(window)) return;

		// Remove all tabs - business cleanup (private chat data) handled automatically in onDestroyed or explicitly if sleeping
		for (const tab of windowTabs) {
			await this.removeTab(window, tab.id);
		}

		const shellView = this.windowShellView.get(windowId);
		if (!isUndefined(shellView)) {
			shellView.webContents.close();
			this.windowShellView.delete(windowId);
		}

		this.windowTabView.delete(windowId);
		this.windowActiveTabId.delete(windowId);
	}

	async cleanupPrivateChatData(windowId: number) {
		const windowTabs = await tabStorage.getTabsByWindowId(windowId.toString());
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
					// Use unified cleanup method from ThreadStorage
					await threadStorage.cleanupThreadData(tab.threadId);
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

	async removeTab(window: BrowserWindow, tabId: string) {
		console.log("Removing Tab --->", tabId);

		// Check if busy
		const tab = this.tabMap.get(tabId);
		const isThreadBusy = tab?.threadId ? threadStateService.isThreadBusy(tab.threadId) : false;

		if (isThreadBusy) {
			console.log(`[TabService] Tab ${tabId} is busy, deferring destruction.`);
			const view = this.tabViewMap.get(tabId);
			if (view) {
				window.contentView.removeChildView(view);
				// view.setVisible(false); // Should be hidden by removeChildView
			}
			this.pendingDestroyTabs.add(tabId);
			return;
		}

		const view = this.tabViewMap.get(tabId);
		if (!isUndefined(view)) {
			window.contentView.removeChildView(view);
			view.webContents.close({ waitForBeforeUnload: true });
		} else {
			if (tab) {
				// Tab exists but has no view (e.g. is sleeping)
				// We must perform business cleanup manually since no webContents destroyed event will fire
				await this.performTabBusinessCleanup(tab);
				this.cleanupTabTempFiles(tab.id);
			}

			this.tabViewMap.delete(tabId);
			this.tabMap.delete(tabId);
			this.tabWindowMap.delete(tabId);
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
		this.tabWindowMap.set(tab.id, window.id);

		// Add to window's view list
		const windowViews = this.windowTabView.get(window.id) || [];
		if (!windowViews.includes(view)) {
			windowViews.push(view);
			this.windowTabView.set(window.id, windowViews);
		}

		// Switch to this tab
		await this.switchActiveTab(window, tab.id);

		this.scheduleWindowResize(window);
	}

	/**
	 * Transfer a tab from one window to another while preserving the WebContentsView
	 */
	async transferTabToWindow(
		fromWindow: BrowserWindow,
		toWindow: BrowserWindow,
		tabId: string,
		tab: Tab,
	): Promise<void> {
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

		// Reattach shortcut engine with new windowId to fix shortcut context
		shortcutService.getEngine().attachToView(view, toWindow.id, tabId);

		// Add to target window
		this.attachViewToWindow(toWindow, view);

		// Update tab data
		this.tabMap.set(tabId, tab);
		this.tabWindowMap.set(tabId, toWindow.id);

		// Add to target window's view list
		const toWindowViews = this.windowTabView.get(toWindow.id) || [];
		toWindowViews.push(view);
		this.windowTabView.set(toWindow.id, toWindowViews);

		// Switch to this tab in target window
		await this.switchActiveTab(toWindow, tabId);
	}

	async focusTabInWindow(window: BrowserWindow, tabId: string): Promise<void> {
		if (window.isDestroyed()) return;

		const view = this.tabViewMap.get(tabId);

		if (isUndefined(view)) {
			// Tab might be sleeping, try to wake via switchActiveTab
			const tab = this.tabMap.get(tabId);
			if (tab?.isSleeping) {
				await this.switchActiveTab(window, tabId);
			}
			return;
		}

		// Ensure the view is attached to the window and visible
		if (view.webContents.isDestroyed()) {
			this.tabViewMap.delete(tabId);
			this.tabMap.delete(tabId);
			return;
		}

		window.contentView.removeChildView(view);
		window.contentView.addChildView(view);

		await this.switchActiveTab(window, tabId);

		view.webContents.focus();
	}

	/**
	 * Create a tab for an existing thread (internal method for window-service)
	 * @returns Tab ID if successful, null otherwise
	 */
	async createTabForExistingThread(
		targetWindow: BrowserWindow,
		threadId: string,
		title: string = "Chat",
		type: TabType = "chat",
		active: boolean = true,
	): Promise<{ tabId: string | null }> {
		// Try to resurrect pending tab first
		const resurrectedTab = await this.resurrectTab(targetWindow, threadId);
		if (resurrectedTab) {
			return { tabId: resurrectedTab.id };
		}

		if (this.isTabLimitReached(targetWindow.id)) return { tabId: null };

		const windowId = targetWindow.id.toString();

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

		const view = await this.newWebContentsView(targetWindow.id, newTab);
		this.attachViewToWindow(targetWindow, view);
		await this.switchActiveTab(targetWindow, newTab.id);

		this.tabMap.set(newTab.id, newTab);
		this.tabWindowMap.set(newTab.id, targetWindow.id);

		const windowViews = this.windowTabView.get(targetWindow.id) || [];
		if (!windowViews.includes(view)) {
			windowViews.push(view);
			this.windowTabView.set(targetWindow.id, windowViews);
		}

		this.scheduleWindowResize(targetWindow);

		// Add new tab to storage
		const finalTabState = await tabStorage.getItemInternal("tab-bar-state");
		if (!isNull(finalTabState)) {
			const currentTabs = finalTabState[windowId]?.tabs || [];
			const updatedTabs = active
				? [...currentTabs.map((t) => ({ ...t, active: false })), newTab]
				: [...currentTabs, newTab];
			finalTabState[windowId] = { tabs: updatedTabs };
			await tabStorage.setItemInternal("tab-bar-state", finalTabState);
			console.log(
				`[TabService] Created tab ${newTabId} for thread ${threadId} in window ${windowId}`,
			);
		}

		return { tabId: newTabId };
	}

	/**
	 * Create a tab for an external URL (internal method for window-service)
	 * @returns Tab ID if successful, null otherwise
	 */
	async createTabForUrl(
		targetWindow: BrowserWindow,
		title: string = "New Tab",
		type: TabType = "aiApplications",
		href: string,
		active: boolean = true,
	): Promise<{ tabId: string | null }> {
		if (this.isTabLimitReached(targetWindow.id)) return { tabId: null };

		const windowId = targetWindow.id.toString();

		const newTabId = nanoid();
		const newThreadId = nanoid();
		const newTab: Tab = {
			id: newTabId,
			title,
			href,
			type,
			active,
			threadId: newThreadId,
		};

		const view = await this.newWebContentsView(targetWindow.id, newTab);
		this.attachViewToWindow(targetWindow, view);
		await this.switchActiveTab(targetWindow, newTab.id);

		this.tabMap.set(newTab.id, newTab);
		this.tabWindowMap.set(newTab.id, targetWindow.id);

		const windowViews = this.windowTabView.get(targetWindow.id) || [];
		if (!windowViews.includes(view)) {
			windowViews.push(view);
			this.windowTabView.set(targetWindow.id, windowViews);
		}

		this.scheduleWindowResize(targetWindow);

		// Add new tab to storage
		const finalTabState = await tabStorage.getItemInternal("tab-bar-state");
		if (!isNull(finalTabState)) {
			const currentTabs = finalTabState[windowId]?.tabs || [];
			const updatedTabs = active
				? [...currentTabs.map((t) => ({ ...t, active: false })), newTab]
				: [...currentTabs, newTab];
			finalTabState[windowId] = { tabs: updatedTabs };
			await tabStorage.setItemInternal("tab-bar-state", finalTabState);
			console.log(`[TabService] Created tab ${newTabId} (${type}, ${href}) in window ${windowId}`);
		}

		return { tabId: newTabId };
	}

	// ******************************* IPC Methods ******************************* //
	async handleNewTabWithThread(
		event: IpcMainInvokeEvent,
		threadId: string,
		title: string = "Chat",
		type: TabType = "chat",
		active: boolean = true,
		initialSearchQuery?: string,
		initialSearchResultIds?: string[],
	): Promise<string | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;
		if (this.isTabLimitReached(window.id)) return null;

		// Try to resurrect pending tab first
		const resurrectedTab = await this.resurrectTab(window, threadId);
		if (resurrectedTab) {
			return stringify(resurrectedTab);
		}

		// ========== CHECK: Prevent duplicate tabs for the same thread ==========
		const windowId = window.id.toString();
		const tabState = await tabStorage.getItemInternal("tab-bar-state");

		console.log(`[TabService] handleNewTabWithThread: threadId=${threadId}, windowId=${windowId}`);
		console.log(`[TabService] Current tabState windows:`, Object.keys(tabState || {}));
		console.log(`[TabService] tabViewMap size:`, this.tabViewMap.size);

		if (!isNull(tabState)) {
			// Check in ALL windows, not just current window
			for (const [wId, wData] of Object.entries(tabState)) {
				const existingTab = wData.tabs.find((t) => t.threadId === threadId);
				if (existingTab) {
					console.log(
						`[TabService] Found existing tab ${existingTab.id} for thread ${threadId} in window ${wId}`,
					);

					// Check if the tab's view still exists
					const existingView = this.tabViewMap.get(existingTab.id);
					console.log(`[TabService] View exists for tab ${existingTab.id}:`, !!existingView);

					if (existingView) {
						// View exists - activate it
						if (wId === windowId) {
							// Same window
							console.log(
								`[TabService] Tab for thread ${threadId} already exists in current window, activating it`,
							);
							const updatedTabs = tabState[wId].tabs.map((t) => ({
								...t,
								active: t.id === existingTab.id,
							}));
							tabState[wId] = { tabs: updatedTabs };
							await tabStorage.setItemInternal("tab-bar-state", tabState);
							await this.focusTabInWindow(window, existingTab.id);
							return stringify(existingTab);
						} else {
							// Different window - this shouldn't happen in normal flow
							console.log(
								`[TabService] Tab for thread ${threadId} exists in window ${wId}, but called from window ${windowId}. Allowing duplicate tab creation.`,
							);
							// Let it create a new tab in current window
							// The old tab will remain in the other window
							break;
						}
					} else {
						// View doesn't exist (was destroyed) - cleanup storage and create new tab
						console.log(
							`[TabService] Tab ${existingTab.id} for thread ${threadId} exists in storage but view is destroyed, cleaning up`,
						);
						// Remove the orphaned tab from storage
						const cleanedTabs = tabState[wId].tabs.filter((t) => t.id !== existingTab.id);
						tabState[wId] = { tabs: cleanedTabs };
						await tabStorage.setItemInternal("tab-bar-state", tabState);
						console.log(
							`[TabService] Cleaned orphaned tab from window ${wId}, will create new tab`,
						);
						// Continue to create new tab
						break;
					}
				}
			}
		}

		console.log(`[TabService] No duplicate found, creating new tab for thread ${threadId}`);
		// ========================================================================

		const { getHref } = getTabConfig(type);
		const newTabId = nanoid();
		const newTab: Tab = {
			id: newTabId,
			title,
			href: getHref(newTabId),
			type,
			active,
			threadId,
			...(initialSearchQuery ? { initialSearchQuery } : {}),
			...(initialSearchResultIds?.length ? { initialSearchResultIds } : {}),
		};

		const view = await this.newWebContentsView(window.id, newTab);
		this.attachViewToWindow(window, view);
		await this.switchActiveTab(window, newTab.id);

		this.tabMap.set(newTab.id, newTab);
		this.tabWindowMap.set(newTab.id, window.id);

		const windowViews = this.windowTabView.get(window.id) || [];
		if (!windowViews.includes(view)) {
			windowViews.push(view);
			this.windowTabView.set(window.id, windowViews);
		}

		this.scheduleWindowResize(window);

		// ========== ATOMIC UPDATE: Add new tab to storage ==========
		// Reuse windowId variable, re-fetch tabState to get latest
		const finalTabState = await tabStorage.getItemInternal("tab-bar-state");
		if (!isNull(finalTabState)) {
			const currentTabs = finalTabState[windowId]?.tabs || [];
			const updatedTabs = active
				? [...currentTabs.map((t) => ({ ...t, active: false })), newTab]
				: [...currentTabs, newTab];
			finalTabState[windowId] = { tabs: updatedTabs };
			await tabStorage.setItemInternal("tab-bar-state", finalTabState);
			console.log(`[TabService] Added new tab ${newTabId} to window ${windowId} storage`);
		}
		// ===========================================================

		return stringify(newTab);
	}

	async handleNewTab(
		event: IpcMainInvokeEvent,
		title: string = "New Chat",
		type: TabType = "chat",
		active: boolean = true,
		href?: string,
		content?: string,
		previewId?: string,
	): Promise<string | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;
		if (this.isTabLimitReached(window.id)) return null;

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
			...(content && { content }), // Add content if provided
			...(previewId && { previewId }), // Add previewId if provided
		};

		if (type === "chat") {
			const [newSessionModel, latestUsedModel, apiKeyHash] = await Promise.all([
				storageService.getItemInternal("PreferencesSettingsStorage:state"),
				sessionStorage.getLatestUsedModel(),
				providerStorage.get302AIApiKeyHash(),
			]);
			const preferencesSettings = newSessionModel as unknown as {
				newSessionModel?: ThreadParmas["selectedModel"];
			} | null;

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
				selectedModel: preferencesSettings?.newSessionModel ?? latestUsedModel,
				isPrivateChatActive: inheritedPrivacyState,
				updatedAt: new Date(),
				apiKeyHash, // Track which API key was used when creating this thread
			};
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const newMessages: any = [];
			await storageService.setItemInternal("app-thread:" + newTab.threadId, newThread);
			await storageService.setItemInternal("app-chat-messages:" + newTab.threadId, newMessages);
		}

		const view = await this.newWebContentsView(window.id, newTab);
		this.attachViewToWindow(window, view);
		await this.switchActiveTab(window, newTab.id);

		this.tabMap.set(newTab.id, newTab);
		this.tabWindowMap.set(newTab.id, window.id);

		const windowViews = this.windowTabView.get(window.id) || [];
		if (!windowViews.includes(view)) {
			windowViews.push(view);
			this.windowTabView.set(window.id, windowViews);
		}

		this.scheduleWindowResize(window);

		// ========== ATOMIC UPDATE: Add new tab to storage ==========
		const windowId = window.id.toString();
		const tabState = await tabStorage.getItemInternal("tab-bar-state");
		if (!isNull(tabState)) {
			const currentTabs = tabState[windowId]?.tabs || [];
			const updatedTabs = active
				? [...currentTabs.map((t) => ({ ...t, active: false })), newTab]
				: [...currentTabs, newTab];
			tabState[windowId] = { tabs: updatedTabs };
			await tabStorage.setItemInternal("tab-bar-state", tabState);
			console.log(`[TabService] Added new tab ${newTabId} to window ${windowId} storage`);
		}
		// ===========================================================

		return stringify(newTab);
	}

	async handleActivateTab(event: IpcMainInvokeEvent, tabId: string) {
		const tab = this.tabMap.get(tabId);
		if (!tab) return;

		const view = this.tabViewMap.get(tabId);
		// If view is missing and not sleeping, something is wrong
		if (isUndefined(view) && !tab.isSleeping) return;

		const callerWindow = BrowserWindow.fromWebContents(event.sender);
		if (isNull(callerWindow)) return;

		// Find which window this tab belongs to (based on view location)
		const tabWindow = this.findWindowForTab(tabId);
		if (isNull(tabWindow)) {
			console.error(`[TabService] Cannot find window for tab ${tabId}`);
			return;
		}

		// If tab is in a different window, focus that window instead
		if (tabWindow.id !== callerWindow.id) {
			console.log(
				`[TabService] Tab ${tabId} is in window ${tabWindow.id}, but called from window ${callerWindow.id}. Focusing target window instead.`,
			);
			// Focus the correct window and activate the tab
			await this.focusTabInWindow(tabWindow, tabId);

			// Update storage
			const targetWindowId = tabWindow.id.toString();
			const tabState = await tabStorage.getItemInternal("tab-bar-state");
			if (!isNull(tabState) && tabState[targetWindowId]) {
				const updatedTabs = tabState[targetWindowId].tabs.map((t) => ({
					...t,
					active: t.id === tabId,
				}));
				tabState[targetWindowId] = { tabs: updatedTabs };
				await tabStorage.setItemInternal("tab-bar-state", tabState);
				console.log(
					`[TabService] Activated tab ${tabId} in window ${targetWindowId} (cross-window)`,
				);
			}

			// Focus the window
			if (tabWindow.isMinimized()) tabWindow.restore();
			if (!tabWindow.isVisible()) tabWindow.show();
			tabWindow.focus();

			return;
		}

		// Tab is in the correct window, activate it
		if (view) {
			callerWindow.contentView.removeChildView(view);
			callerWindow.contentView.addChildView(view);
		}
		await this.switchActiveTab(callerWindow, tabId);

		// ========== ATOMIC UPDATE: Update active state in storage ==========
		const windowId = callerWindow.id.toString();
		const tabState = await tabStorage.getItemInternal("tab-bar-state");
		if (!isNull(tabState) && tabState[windowId]) {
			const updatedTabs = tabState[windowId].tabs.map((t) => ({
				...t,
				active: t.id === tabId,
			}));
			tabState[windowId] = { tabs: updatedTabs };
			await tabStorage.setItemInternal("tab-bar-state", tabState);
			console.log(`[TabService] Activated tab ${tabId} in window ${windowId} storage`);
		}
		// ================================================================
	}

	private findWindowForTab(tabId: string): BrowserWindow | null {
		const windowId = this.tabWindowMap.get(tabId);
		if (isUndefined(windowId)) return null;
		const window = BrowserWindow.fromId(windowId);
		return window && !window.isDestroyed() ? window : null;
	}

	/**
	 * Check if the tab limit has been reached for a given window.
	 * Uses in-memory windowTabView for zero I/O cost.
	 */
	private isTabLimitReached(windowId: number): boolean {
		const views = this.windowTabView.get(windowId) || [];
		if (views.length >= MAX_TABS_PER_WINDOW) {
			console.warn(
				`[TabService] Tab limit (${MAX_TABS_PER_WINDOW}) reached for window ${windowId}`,
			);
			return true;
		}
		return false;
	}

	async getActiveTab(event: IpcMainInvokeEvent): Promise<Tab | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;
		const [tabs, activeTabId] = await Promise.all([
			tabStorage.getTabsByWindowId(window.id.toString()),
			tabStorage.getActiveTabId(window.id.toString()),
		]);

		if (isNull(tabs) || isNull(activeTabId)) return null;

		const tab = tabs.find((tab) => tab.id === activeTabId);
		if (isUndefined(tab)) return null;

		return tab;
	}

	async getAllTabsForCurrentWindow(event: IpcMainInvokeEvent): Promise<Tab[] | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;
		const result = await tabStorage.getTabsByWindowId(window.id.toString());
		return result;
	}

	async getAllTabs(_event: IpcMainInvokeEvent): Promise<Tab[] | null> {
		return (await tabStorage.getAllTabs()) ?? [];
	}

	async handleTabClose(event: IpcMainInvokeEvent, tabId: string, newActiveTabId: string | null) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		const view = this.tabViewMap.get(tabId);
		if (isUndefined(view)) {
			// Tab might be sleeping, still need to remove it from maps and potentially cleanup
			const tab = this.tabMap.get(tabId);
			if (tab) {
				await this.removeTab(window, tabId);
			}
			return;
		}

		if (newActiveTabId && this.windowActiveTabId.get(window.id) === tabId) {
			await this.switchActiveTab(window, newActiveTabId);
		}

		// Business cleanup (private chat data) handled automatically in onDestroyed or explicitly if sleeping
		await this.removeTab(window, tabId);
	}

	async handleTabCloseOthers(event: IpcMainInvokeEvent, tabId: string, tabIdsToClose: string[]) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		await this.switchActiveTab(window, tabId);

		// Business cleanup (private chat data) handled automatically in onDestroyed or explicitly if sleeping
		for (const tabIdToClose of tabIdsToClose) {
			await this.removeTab(window, tabIdToClose);
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
			await this.switchActiveTab(window, tabId);
		}

		// Business cleanup (private chat data) handled automatically in onDestroyed or explicitly if sleeping
		for (const tabIdToClose of tabIdsToClose) {
			await this.removeTab(window, tabIdToClose);
		}
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

	async selectTab(windowId: number, tabId: string): Promise<void> {
		const window = BrowserWindow.fromId(windowId);
		if (!window) return;
		await this.switchActiveTab(window, tabId);
	}

	/**
	 * Replace the current tab's thread content with a new thread
	 * This recreates the WebContentsView with new thread data
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

			const updatedTab = {
				...currentTab,
				threadId: newThreadId,
				title: threadData.title as string,
			};

			window.contentView.removeChildView(oldView);

			oldView.webContents.close({ waitForBeforeUnload: false });

			const newView = await this.newWebContentsView(window.id, updatedTab);

			this.tabMap.set(tabId, updatedTab);

			const windowViews = this.windowTabView.get(window.id);
			if (!isUndefined(windowViews)) {
				const viewIndex = windowViews.indexOf(oldView);
				if (viewIndex !== -1) {
					windowViews[viewIndex] = newView;
				} else {
					windowViews.push(newView);
				}
			}

			this.attachViewToWindow(window, newView);
			await this.switchActiveTab(window, tabId);

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
	 * Trigger create skill summary in the chat
	 */
	async triggerCreateSkillSummary(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		console.log(`[triggerCreateSkillSummary] Triggering summary for thread ${threadId}`);

		try {
			// Find the tab with matching threadId
			let targetView: WebContentsView | undefined;

			for (const [tabId, tab] of this.tabMap.entries()) {
				if (tab.threadId === threadId) {
					targetView = this.tabViewMap.get(tabId);
					break;
				}
			}

			if (isUndefined(targetView) || targetView.webContents.isDestroyed()) {
				console.warn(
					`[triggerCreateSkillSummary] View not found or destroyed for thread ${threadId}`,
				);
				return false;
			}

			// Send a message to the tab
			targetView.webContents.send("tab:create-skill-summary", { threadId });

			return true;
		} catch (error) {
			console.error(`[triggerCreateSkillSummary] Failed to trigger summary:`, error);
			return false;
		}
	}

	/**
	 * Notify sandbox created event to the tab associated with the given threadId
	 */
	notifySandboxCreated(threadId: string, sandboxId: string): void {
		console.log(
			`[TabService] Notifying sandbox created: threadId=${threadId}, sandboxId=${sandboxId}`,
		);

		// Find the tab with matching threadId
		let targetView: WebContentsView | undefined;
		for (const [tabId, tab] of this.tabMap.entries()) {
			if (tab.threadId === threadId) {
				targetView = this.tabViewMap.get(tabId);
				break;
			}
		}

		if (targetView && !targetView.webContents.isDestroyed()) {
			targetView.webContents.send("code-agent:sandbox-created", {
				threadId,
				sandboxId,
			});
			console.log(`[TabService] Sandbox created event sent to tab with threadId=${threadId}`);
		} else {
			console.warn(`[TabService] Could not find active tab for threadId=${threadId}`);
		}
	}
}

export const tabService = new TabService();
