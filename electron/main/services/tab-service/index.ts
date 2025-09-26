import type { Tab, TabType, ThreadParmas } from "@shared/types";
import { BrowserWindow, WebContentsView, type IpcMainInvokeEvent } from "electron";
import { isNull, isUndefined } from "es-toolkit";
import { nanoid } from "nanoid";
import path from "node:path";
import { stringify } from "superjson";
import { ENVIRONMENT, isMac, TITLE_BAR_HEIGHT } from "../../constants";
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

	constructor() {
		this.tabViewMap = new Map();
		this.tabMap = new Map();
		this.windowTabView = new Map();
		this.windowActiveTabId = new Map();
		this.windowShellView = new Map();
	}

	// ******************************* Private Methods ******************************* //
	private async newWebContentsView(windowId: number, tab: Tab): Promise<WebContentsView> {
		const thread = await storageService.getItemInternal("app-thread:" + tab.threadId);
		const messages = await storageService.getItemInternal("app-chat-messages:" + tab.threadId);
		const view = new WebContentsView({
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.js"),
				devTools: ENVIRONMENT.IS_DEV,
				webgl: true,
				additionalArguments: [
					`--window-id=${windowId}`,
					`--tab=${stringify(tab)}`,
					`--thread=${stringify(thread)}`,
					`--messages=${stringify(messages)}`,
				],
			},
		});

		this.tabViewMap.set(tab.id, view);

		if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
			view.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
			view.webContents.on("did-frame-finish-load", () => {
				view.webContents.openDevTools({ mode: "detach" });
			});
		} else {
			view.webContents.loadURL("app://localhost");
		}

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

		window.addListener("resize", () => {
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
		});
	}

	initWindowShellView(shellWindowId: number, shellView: WebContentsView) {
		this.windowShellView.set(shellWindowId, shellView);
	}

	getTabById(tabId: string): Tab | undefined {
		return this.tabMap.get(tabId);
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

		return JSON.stringify(newTab);
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

		if (!isUndefined(view)) {
			window.contentView.removeChildView(view);
			view.webContents.close();
		}

		this.tabViewMap.delete(tabId);
		this.tabMap.delete(tabId);

		const windowViews = this.windowTabView.get(window.id);
		if (!isUndefined(windowViews)) {
			const updatedViews = windowViews.filter((v) => v !== view);
			this.windowTabView.set(window.id, updatedViews);
		}

		const activeTabId = this.windowActiveTabId.get(window.id);
		if (activeTabId === tabId) {
			if (newActiveTabId) {
				this.switchActiveTab(window, newActiveTabId);
			} else {
				this.windowActiveTabId.delete(window.id);
			}
		}
	}

	async handleTabCloseOthers(event: IpcMainInvokeEvent, tabId: string, tabIdsToClose: string[]) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		for (const tabIdToClose of tabIdsToClose) {
			const view = this.tabViewMap.get(tabIdToClose);
			if (!isUndefined(view)) {
				window.contentView.removeChildView(view);
				view.webContents.close();
			}
			this.tabViewMap.delete(tabIdToClose);
			this.tabMap.delete(tabIdToClose);
		}

		const targetView = this.tabViewMap.get(tabId);
		if (!isUndefined(targetView)) {
			this.windowTabView.set(window.id, [targetView]);
		}

		this.switchActiveTab(window, tabId);
	}

	async handleTabCloseOffside(
		event: IpcMainInvokeEvent,
		tabId: string,
		tabIdsToClose: string[],
		remainingTabIds: string[],
		shouldSwitchActive: boolean,
	) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		for (const tabIdToClose of tabIdsToClose) {
			const view = this.tabViewMap.get(tabIdToClose);
			if (!isUndefined(view)) {
				window.contentView.removeChildView(view);
				view.webContents.close();
			}
			this.tabViewMap.delete(tabIdToClose);
			this.tabMap.delete(tabIdToClose);
		}

		const remainingViews = remainingTabIds
			.map((tabId) => this.tabViewMap.get(tabId))
			.filter((view) => !isUndefined(view));

		this.windowTabView.set(window.id, remainingViews);

		if (shouldSwitchActive) {
			this.switchActiveTab(window, tabId);
		}
	}

	async handleTabCloseAll(event: IpcMainInvokeEvent) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		this.tabViewMap.entries().forEach(([tabId, view]) => {
			window.contentView.removeChildView(view);
			this.tabViewMap.delete(tabId);
			this.tabMap.delete(tabId);

			view.webContents.close();
		});

		this.windowTabView.delete(window.id);
		this.windowActiveTabId.delete(window.id);
	}

	async handleShellViewLevel(event: IpcMainInvokeEvent, up: boolean) {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;
		const shellView = this.windowShellView.get(window.id);
		if (isUndefined(shellView)) return;

		if (up) {
			if (!isMac) {
				window.contentView.removeChildView(shellView);
			}
			window.contentView.addChildView(shellView);
			console.log("window.contentView.addChildView ---- shellView");

			shellView.webContents.focus();
		} else {
			const activeTabId = this.windowActiveTabId.get(window.id);
			if (isUndefined(activeTabId)) return;
			const activeTabView = this.tabViewMap.get(activeTabId);
			if (isUndefined(activeTabView)) return;

			if (!isMac) {
				window.contentView.removeChildView(activeTabView);
			}
			window.contentView.addChildView(activeTabView);
			console.log("window.contentView.addChildView ---- activeTabView");

			activeTabView.webContents.focus();
		}
	}
}

export const tabService = new TabService();
