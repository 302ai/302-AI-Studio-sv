import type { Tab } from "@shared/types";
import { BrowserWindow, WebContentsView, type IpcMainInvokeEvent } from "electron";
import { isNull, isUndefined } from "es-toolkit";
import path from "node:path";
import { TITLE_BAR_HEIGHT } from "../../constants";
import { tabStorage } from "../storage-service/tab-storage";

export class TabService {
	private tabMap: Map<string, WebContentsView>;
	private currentActiveTabId: string | null = null;
	shellView: WebContentsView | null = null;

	constructor() {
		this.tabMap = new Map();
	}

	private newWebContentsView(): { view: WebContentsView; tabId: string } {
		const view = new WebContentsView({
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.js"),
				// devTools: ENVIRONMENT.IS_DEV,
				webgl: true,
			},
		});

		const tabId = view.webContents.id.toString();
		this.tabMap.set(tabId, view);

		if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
			view.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
			// view.webContents.on("did-frame-finish-load", () => {
			// 	view.webContents.openDevTools({ mode: "detach" });
			// });
		} else {
			view.webContents.loadURL("app://localhost");
		}

		return { view, tabId };
	}

	private attachViewToWindow(view: WebContentsView, window: BrowserWindow) {
		window.contentView.addChildView(view);
		const { width, height } = window.getContentBounds();
		view.setBounds({ x: 0, y: TITLE_BAR_HEIGHT + 1, width, height: height - TITLE_BAR_HEIGHT - 1 });

		if (!isNull(this.shellView)) {
			window.contentView.addChildView(this.shellView);

			if (!this.shellView.webContents.isFocused()) {
				this.shellView.webContents.focus();
			}

			// this.shellView.webContents.addListener("before-mouse-event", (_event, input) => {
			// 	// window.contentView.addChildView(view);
			// 	console.log("before-input-event", input);
			// 	const { y } = input;
			// 	if (y > TITLE_BAR_HEIGHT) {
			// 		window.contentView.addChildView(view);
			// 	} else {
			// 		window.contentView.addChildView(this.shellView!);
			// 	}
			// });
		}
	}

	private switchActiveTab(newActiveTabId: string) {
		if (this.currentActiveTabId) {
			const prevView = this.tabMap.get(this.currentActiveTabId);
			if (prevView) {
				prevView.setVisible(false);
			}
		}

		const newView = this.tabMap.get(newActiveTabId);
		if (newView) {
			newView.setVisible(true);
		}

		this.currentActiveTabId = newActiveTabId;
	}

	async initWindowTabs(window: BrowserWindow, tabs: Tab[]): Promise<Tab[]> {
		let activeTabView: WebContentsView | null = null;
		let activeTabId: string | null = null;

		const updatedTabs = tabs.map((tab) => {
			const { view, tabId } = this.newWebContentsView();
			if (tab.active) {
				activeTabView = view;
				activeTabId = tabId;
			} else {
				this.attachViewToWindow(view, window);
			}
			return {
				...tab,
				id: tabId,
			};
		});

		if (activeTabView && activeTabId) {
			this.attachViewToWindow(activeTabView, window);
			this.switchActiveTab(activeTabId);
		}

		return updatedTabs;
	}

	async handleNewTab(event: IpcMainInvokeEvent): Promise<string | null> {
		const { view, tabId } = this.newWebContentsView();
		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return null;
		this.attachViewToWindow(view, window);
		this.switchActiveTab(tabId);

		return tabId;
	}

	async handleActivateTab(event: IpcMainInvokeEvent, tabId: string) {
		const view = this.tabMap.get(tabId);
		if (isUndefined(view)) return;

		const window = BrowserWindow.fromWebContents(event.sender);
		if (isNull(window)) return;

		this.attachViewToWindow(view, window);
		this.switchActiveTab(tabId);
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
}

export const tabService = new TabService();
