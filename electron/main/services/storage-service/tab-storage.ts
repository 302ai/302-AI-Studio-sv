import { prefixStorage, type Tab, type TabState } from "@shared/types";
import { isString } from "es-toolkit";
import { isArray } from "es-toolkit/compat";
import { StorageService } from ".";

export class TabStorage extends StorageService<TabState> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "TabStorage");
	}

	async getTabs(): Promise<Tab[] | null> {
		const result = await this.getItemInternal("tabs");

		return isArray(result) ? (result as Tab[]) : null;
	}

	async getActiveTabId(): Promise<string | null> {
		const result = await this.getItemInternal("active-tab-id");

		return isString(result) ? result : null;
	}
}

export const tabStorage = new TabStorage();
