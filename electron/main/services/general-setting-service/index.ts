import type { LanguageCode } from "@shared/storage/general-settings";
import { generalSettingsStorage } from "../storage-service/general-settings-storage";

export class GeneralSettingsService {
	async getLanguage(): Promise<LanguageCode> {
		const language = await generalSettingsStorage.getLanguage();
		return language;
	}
}

export const generalSettingsService = new GeneralSettingsService();
