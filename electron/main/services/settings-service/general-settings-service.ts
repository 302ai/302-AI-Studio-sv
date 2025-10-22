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
	async handleLanguageChanged(event: IpcMainInvokeEvent): Promise<void> {
		emitter.emit("general-settings:language-changed", null);

		const allWebContents = webContents.getAllWebContents();
		allWebContents.forEach((webContent) => {
			if (webContent.id === event.sender.id) return;
			webContent.reload();
		});
	}
}

export const generalSettingsService = new GeneralSettingsService();
