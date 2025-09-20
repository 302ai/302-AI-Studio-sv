import { prefixStorage, ThemeState } from "@shared/types";
import { StorageService } from ".";

export class ThemeStorage extends StorageService<ThemeState> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "ThemeStorage");
	}

	async getThemeState() {
		return this.getItemInternal("state");
	}
}

export const themeStorage = new ThemeStorage();
