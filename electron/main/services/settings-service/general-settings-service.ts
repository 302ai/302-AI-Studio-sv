import type { LanguageCode } from "@shared/storage/general-settings";
import { webContents, type IpcMainInvokeEvent } from "electron";
import { emitter } from "../broadcast-service";
import { generalSettingsStorage } from "../storage-service/general-settings-storage";

export class GeneralSettingsService {
	async getLanguage(): Promise<LanguageCode> {
		const language = await generalSettingsStorage.getLanguage();
		return language;
	}

	// ******************************* IPC Methods ******************************* //

	async handleLanguageChanged(event: IpcMainInvokeEvent, language: LanguageCode): Promise<void> {
		const allWebContents = webContents.getAllWebContents();

		// Reload all webContents except the sender to apply language change
		// PersistedState will restore chat messages and thread data from storage
		allWebContents.forEach((webContent) => {
			if (webContent.id === event.sender.id) return;
			webContent.reload();
		});

		emitter.emit("general-settings:language-changed", { language });
	}
}

export const generalSettingsService = new GeneralSettingsService();
