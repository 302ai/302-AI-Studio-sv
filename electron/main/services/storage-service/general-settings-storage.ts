import type { GeneralSettingsState, LanguageCode } from "@shared/storage/general-settings";
import { prefixStorage } from "@shared/types";
import { StorageService } from ".";

export class GeneralSettingsStorage extends StorageService<GeneralSettingsState> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "GeneralSettingsStorage");
	}

	async getLanguage(): Promise<LanguageCode> {
		const result = await this.getItemInternal("state");
		if (!result) {
			return "zh";
		}
		return result.language;
	}
}

export const generalSettingsStorage = new GeneralSettingsStorage();
