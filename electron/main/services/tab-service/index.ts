import type { Tab, TabType, ThreadParmas } from "@shared/types";
import { BrowserWindow, WebContentsView, type IpcMainInvokeEvent } from "electron";
import { isNull, isUndefined } from "es-toolkit";
import { nanoid } from "nanoid";
import { stringify } from "superjson";
import { isMac, TITLE_BAR_HEIGHT } from "../../constants";
import { WebContentsFactory } from "../../factories/web-contents-factory";
import {
	withDevToolsShortcuts,
	withLoadHandlers,
	withLifecycleHandlers,
} from "../../mixins/web-contents-mixins";
import { TempStorage } from "../../utils/temp-storage";
import { storageService } from "../storage-service";
import { tabStorage } from "../storage-service/tab-storage";

type TabConfig = {
	title: string;
	getHref: (id: string) => string;
};

const TAB_CONFIGS: Record<TabType, TabConfig> = {
	chat: { title: "New Chat", getHref: (id) => `/chat/${id}` },
	settings: { title: "Settings", getHref: () => "/settings/general-settings" },
	"302ai-tool": { title: "302AI Tool", getHref: (id) => `/tool/${id}` },
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

	// ******************************* Private Methods ******************************* //
	private async newWebContentsView(windowId: number, tab: Tab): Promise<WebContentsView> {
		const thread = await storageService.getItemInternal("app-thread:" + tab.threadId);
		const messages = await storageService.getItemInternal("app-chat-messages:" + tab.threadId);

		const threadFilePath = TempStorage.writeData(thread, "thread");
		const messagesFilePath = TempStorage.writeData(messages, "messages");

		this.tempFileRegistry.set(tab.id, [threadFilePath, messagesFilePath]);

		// Create view using factory
		const view = WebContentsFactory.createTabView({
			windowId,
			type: "tab",
			tab,
			threadFilePath,
			messagesFilePath,
		});

		this.tabViewMap.set(tab.id, view);

		// Add devTools shortcuts
		withDevToolsShortcuts(view);

		// Add load handlers
		withLoadHandlers(view, {
			baseUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL || "app://localhost",
			autoOpenDevTools: !!MAIN_WINDOW_VITE_DEV_SERVER_URL,
		});

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
				console.log(
					"Checking tempFileRegistry ---> ",
					this.tempFileRegistry.has(capturedTabId) ? "failed" : "passed",
				);
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

	// ******************************* Main Process Methods ******************************* //
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
		windowTabs.forEach((tab) => {
			this.removeTab(window, tab.id);
		});

		const shellView = this.windowShellView.get(windowId);
		if (!isUndefined(shellView)) {
			shellView.webContents.close();
			this.windowShellView.delete(windowId);
		}

		this.windowTabView.delete(windowId);
		this.windowActiveTabId.delete(windowId);
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
		windowViews.push(view);
		this.windowTabView.set(window.id, windowViews);

		// Switch to this tab
		this.switchActiveTab(window, tab.id);
	}

	// ******************************* IPC Methods ******************************* //
	async handleNewTab(
		event: IpcMainInvokeEvent,
		title: string = "New Chat",
		type: TabType = "chat",
		active: boolean = true,
	): Promise<string | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;

		const { title: tabTitle, getHref } = getTabConfig(type);
		const newTabId = nanoid();
		const newTab: Tab = {
			id: newTabId,
			title: title ?? tabTitle,
			href: getHref(newTabId),
			type,
			active,
			threadId: nanoid(),
		};
		const newThread: ThreadParmas = {
			title: "new tab",
			temperature: 0,
			topP: 1,
			frequencyPenalty: 0,
			presencePenalty: 0,
			maxTokens: 1000,
			inputValue: "",
			attachments: [],
			mcpServers: [],
			isThinkingActive: false,
			isOnlineSearchActive: false,
			isMCPActive: false,
			selectedModel: null,
			isPrivateChatActive: false,
		};
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const newMessages: any = [];
		await storageService.setItemInternal("app-thread:" + newTab.threadId, newThread);
		await storageService.setItemInternal("app-chat-messages:" + newTab.threadId, newMessages);
		const view = await this.newWebContentsView(window.id, newTab);
		this.attachViewToWindow(window, view);
		this.switchActiveTab(window, newTab.id);

		this.tabMap.set(newTab.id, newTab);

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

		this.removeTab(window, tabId);
	}

	async handleTabCloseOthers(event: IpcMainInvokeEvent, tabId: string, tabIdsToClose: string[]) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		this.switchActiveTab(window, tabId);
		for (const tabIdToClose of tabIdsToClose) {
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
		for (const tabIdToClose of tabIdsToClose) {
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
}

export const tabService = new TabService();
