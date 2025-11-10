import type { ChatMessage, Tab, TabType, ThreadParmas } from "@shared/types";
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
import { codeAgentService } from "../code-agent-service";
import { shortcutService } from "../shortcut-service";
import { storageService } from "../storage-service";
import { sessionStorage } from "../storage-service/session-storage";
import { tabStorage } from "../storage-service/tab-storage";

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

	constructor() {
		this.tabViewMap = new Map();
		this.tabMap = new Map();
		this.windowTabView = new Map();
		this.windowActiveTabId = new Map();
		this.windowShellView = new Map();
		this.tempFileRegistry = new Map();
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

	private async afterTabClose(tab: Tab) {
		const thread = (await storageService.getItemInternal(
			"app-thread:" + tab.threadId,
		)) as ThreadParmas | null;
		const messages = (await storageService.getItemInternal("app-chat-messages:" + tab.threadId)) as
			| ChatMessage[]
			| null;

		if (thread?.isPrivateChatActive) {
			console.log(`[Privacy] Deleting private chat data for tab ${tab.id}, thread ${tab.threadId}`);
			await storageService.removeItemInternal("app-thread:" + tab.threadId);
			await storageService.removeItemInternal("app-chat-messages:" + tab.threadId);
			await codeAgentService.removeCodeAgentState(tab.threadId);
		} else if (messages?.length === 0) {
			await storageService.removeItemInternal("app-thread:" + tab.threadId);
			await storageService.removeItemInternal("app-chat-messages:" + tab.threadId);
			await codeAgentService.removeCodeAgentState(tab.threadId);
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
		const windowTabs = await tabStorage.getTabsByWindowId(windowId.toString());
		if (isNull(windowTabs)) return;
		const window = BrowserWindow.fromId(windowId);
		if (isNull(window)) return;

		// Check each tab and delete private chat data
		for (const tab of windowTabs) {
			if (tab.type === "chat" && tab.threadId) {
				this.afterTabClose(tab);
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
	}

	/**
	 * Cleanup private chat data for all tabs in a window without removing the tabs themselves.
	 * Used when closing the last window to ensure private data is deleted.
	 */
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
			window.contentView.removeChildView(view);
			view.webContents.close({ waitForBeforeUnload: true });
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
							this.focusTabInWindow(window, existingTab.id);
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
		};

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
			const [newSessionModel, latestUsedModel] = await Promise.all([
				storageService.getItemInternal("PreferencesSettingsStorage:state"),
				sessionStorage.getLatestUsedModel(),
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
		const view = this.tabViewMap.get(tabId);
		if (isUndefined(view)) return;

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
			this.focusTabInWindow(tabWindow, tabId);

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
		callerWindow.contentView.removeChildView(view);
		callerWindow.contentView.addChildView(view);
		this.switchActiveTab(callerWindow, tabId);

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
		// Search all windows to find which one contains this tab
		for (const [windowId, views] of this.windowTabView.entries()) {
			const view = this.tabViewMap.get(tabId);
			if (view && views.includes(view)) {
				const window = BrowserWindow.fromId(windowId);
				return window && !window.isDestroyed() ? window : null;
			}
		}
		return null;
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
		if (isUndefined(view)) return;

		if (newActiveTabId && this.windowActiveTabId.get(window.id) === tabId) {
			this.switchActiveTab(window, newActiveTabId);
		}

		// Check if this tab is a private chat and delete its data
		const tab = this.tabMap.get(tabId);
		if (tab?.type === "chat" && tab.threadId) {
			this.afterTabClose(tab);
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
				this.afterTabClose(tab);
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
}

export const tabService = new TabService();
