import type { Tab } from "@shared/types";
import { BrowserWindow, WebContentsView, type IpcMainInvokeEvent } from "electron";
import path from "node:path";
import { ENVIRONMENT, TITLE_BAR_HEIGHT } from "../../constants";
import { tabStorage } from "../storage-service/tab-storage";

export class TabService {
	private tabMap: Map<string, WebContentsView>;

	constructor() {
		this.tabMap = new Map();
	}

	async handleNewTab(event: IpcMainInvokeEvent): Promise<string | null> {
		const view = new WebContentsView({
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.js"),
				devTools: ENVIRONMENT.IS_DEV,
				webgl: true,
			},
		});

		if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
			view.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
			view.webContents.on("did-frame-finish-load", () => {
				view.webContents.openDevTools({ mode: "detach" });
			});
		} else {
			view.webContents.loadURL("app://localhost");
		}

		const tabId = view.webContents.id.toString();
		this.tabMap.set(tabId, view);

		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return null;
		window.contentView.addChildView(view);
		const { width, height } = window.getContentBounds();
		view.setBounds({ x: 0, y: TITLE_BAR_HEIGHT, width, height: height - TITLE_BAR_HEIGHT });

		return tabId;
	}

	async handleActivateTab(event: IpcMainInvokeEvent, tabId: string) {
		const view = this.tabMap.get(tabId);
		if (!view) return;

		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return;
		window.contentView.addChildView(view);
		const { width, height } = window.getContentBounds();
		view.setBounds({ x: 0, y: TITLE_BAR_HEIGHT, width, height: height - TITLE_BAR_HEIGHT });
	}

	async getActiveTab(event: IpcMainInvokeEvent): Promise<Tab | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return null;
		const [tabs, activeTabId] = await Promise.all([
			tabStorage.getTabs(window.id.toString()),
			tabStorage.getActiveTabId(window.id.toString()),
		]);

		if (!tabs || !activeTabId) return null;

		const tab = tabs.find((tab) => tab.id === activeTabId);
		if (!tab) return null;

		return tab;
	}
}

export const tabService = new TabService();
