import type {
	GeneralSettingsState,
	LanguageCode,
	ProxySettings,
	UpdateChannel,
} from "@shared/storage/general-settings";
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

	async getAutoUpdate(): Promise<boolean> {
		const result = await this.getItemInternal("state");
		if (!result) {
			return false;
		}
		return result.autoUpdate ?? false;
	}

	async getUpdateChannel(): Promise<UpdateChannel> {
		const result = await this.getItemInternal("state");
		if (!result) {
			return "stable";
		}
		return result.updateChannel ?? "stable";
	}

	async getProxySettings(): Promise<ProxySettings> {
		const result = await this.getItemInternal("state");
		if (!result || !result.proxy) {
			return {
				enabled: false,
				host: "",
				port: 8080,
			};
		}
		return result.proxy;
	}
}

export const generalSettingsStorage = new GeneralSettingsStorage();
