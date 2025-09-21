import { prefixStorage, type Tab, type TabState } from "@shared/types";
import { StorageService } from ".";

export class TabStorage extends StorageService<TabState> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "TabStorage");
	}

	async getTabs(windowId: string): Promise<Tab[] | null> {
		const result = await this.getItemInternal("tab-bar-state");

		return result ? result[windowId].tabs : null;
	}

	async getActiveTabId(windowId: string): Promise<string | null> {
		const result = await this.getItemInternal("tab-bar-state");
		if (!result) return null;

		const activeTabId = result[windowId].tabs.find((t) => t.active)?.id;
		return activeTabId ?? null;
	}
}

export const tabStorage = new TabStorage();
