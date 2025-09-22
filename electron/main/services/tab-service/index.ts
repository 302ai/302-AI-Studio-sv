import type { Tab } from "@shared/types";
import { BrowserWindow, WebContentsView, type IpcMainInvokeEvent } from "electron";
import { isNull, isUndefined } from "es-toolkit";
import path from "node:path";
import { ENVIRONMENT, TITLE_BAR_HEIGHT } from "../../constants";
import { tabStorage } from "../storage-service/tab-storage";

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

	private newWebContentsView(): { view: WebContentsView; tabId: string } {
		const view = new WebContentsView({
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.js"),
				devTools: ENVIRONMENT.IS_DEV,
				webgl: true,
			},
		});

		const tabId = view.webContents.id.toString();
		this.tabViewMap.set(tabId, view);

		if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
			view.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
			view.webContents.on("did-frame-finish-load", () => {
				view.webContents.openDevTools({ mode: "detach" });
			});
		} else {
			view.webContents.loadURL("app://localhost");
		}

		return { view, tabId };
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
		if (newView) {
			newView.setVisible(true);
		}

		this.windowActiveTabId.set(window.id, newActiveTabId);
	}

	// ******************************* Main Process Methods ******************************* //

	async initWindowTabs(window: BrowserWindow, tabs: Tab[]): Promise<Tab[]> {
		let activeTabView: WebContentsView | null = null;
		let activeTabId: string | null = null;
		let views: WebContentsView[] = [];

		const updatedTabs = tabs.map((tab) => {
			const { view, tabId } = this.newWebContentsView();

			if (tab.active) {
				activeTabView = view;
				activeTabId = tabId;
			} else {
				this.attachViewToWindow(window, view);
			}

			this.tabMap.set(tabId, tab);
			views.push(view);

			return {
				...tab,
				id: tabId,
			};
		});

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

		return updatedTabs;
	}

	initWindowShellView(shellWindowId: number, shellView: WebContentsView) {
		this.windowShellView.set(shellWindowId, shellView);
	}

	// ******************************* IPC Methods ******************************* //

	async handleNewTab(event: IpcMainInvokeEvent): Promise<string | null> {
		const { view, tabId } = this.newWebContentsView();
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;
		this.attachViewToWindow(window, view);
		this.switchActiveTab(window, tabId);

		return tabId;
	}

	async handleActivateTab(event: IpcMainInvokeEvent, tabId: string) {
		const view = this.tabViewMap.get(tabId);
		if (isUndefined(view)) return;

		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		this.attachViewToWindow(window, view);
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
			window.contentView.addChildView(shellView);
		} else {
			const activeTabId = this.windowActiveTabId.get(window.id);
			if (isUndefined(activeTabId)) return;
			const activeTabView = this.tabViewMap.get(activeTabId);
			if (isUndefined(activeTabView)) return;
			window.contentView.addChildView(activeTabView);
		}
	}
}

export const tabService = new TabService();
