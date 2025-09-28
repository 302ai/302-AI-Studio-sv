import { prefixStorage, type Tab, type TabState } from "@shared/types";
import { webContents } from "electron";
import { isNull } from "es-toolkit";
import { nanoid } from "nanoid";
import { StorageService } from ".";

export class TabStorage extends StorageService<TabState> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "TabStorage");
	}

	async getTabs(windowId: string): Promise<Tab[] | null> {
		console.log("getTabs", windowId);
		const result = await this.getItemInternal("tab-bar-state");
		return result ? result[windowId].tabs : null;
	}

	async getActiveTabId(windowId: string): Promise<string | null> {
		const result = await this.getItemInternal("tab-bar-state");
		if (!result) return null;

		const activeTabId = result[windowId].tabs.find((t) => t.active)?.id;
		return activeTabId ?? null;
	}

	async getAllWindowsTabs(): Promise<Tab[][] | null> {
		const allWindowsTabs: Tab[][] = [];

		const result = await this.getItemInternal("tab-bar-state");
		if (isNull(result)) {
			const tabId = nanoid();
			const initTab: Tab = {
				id: tabId,
				title: "New Chat",
				href: `/chat/${tabId}`,
				type: "chat",
				active: true,
				threadId: nanoid(),
			};
			allWindowsTabs.push([initTab]);

			await this.setItemInternal("tab-bar-state", {
				"1": {
					tabs: [initTab],
				},
			});
		} else {
			Object.values(result).forEach((windowTabs) => {
				allWindowsTabs.push(windowTabs.tabs);
			});
		}

		return allWindowsTabs;
	}

	async initWindowMapping(newWindowIds: number[], windowsTabsArray: Tab[][]): Promise<void> {
		const newTabState: TabState = {};

		newWindowIds.forEach((windowId, index) => {
			const tabs = windowsTabsArray[index];
			if (tabs) {
				newTabState[windowId.toString()] = {
					tabs,
				};
			}
		});

		await this.setItemInternal("tab-bar-state", newTabState);
	}

	async updateWindowTabs(windowId: string, tabs: Tab[]) {
		const tabState = await this.getItemInternal("tab-bar-state");
		if (isNull(tabState)) return;
		tabState[windowId] ??= { tabs: [] };
		tabState[windowId].tabs = tabs;
		await this.setItemInternal("tab-bar-state", tabState);
	}

	async removeWindowState(windowId: string) {
		const tabState = await this.getItemInternal("tab-bar-state");
		if (isNull(tabState)) return;
		delete tabState[windowId];
		await this.setItemInternal("tab-bar-state", tabState);
	}

	// Override setItemInternal to use the prefixed key for sync messages
	async setItemInternal(key: string, value: TabState): Promise<void> {
		const versionedValue = this.addVersionIfNeeded(value);
		await this.storage.setItem(this.ensureJsonExtension(key), versionedValue);

		// Use the prefixed key for sync messages to match frontend expectations
		const prefixedKey = `TabStorage:${key}`;
		const allWebContents = webContents.getAllWebContents();
		allWebContents.forEach((wc) => {
			if (!wc.isDestroyed()) {
				wc.send(`sync:${prefixedKey}`, versionedValue);
			}
		});
	}
}

export const tabStorage = new TabStorage();
