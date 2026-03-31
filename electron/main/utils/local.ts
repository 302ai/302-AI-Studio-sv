/**
 *Description: get user local
 *Assisted: GPT-5.4
 *Author: Leessmin
 *Date: 2026-03-30
 **/

import { generalSettingsStorage } from "@electron/main/services/storage-service/general-settings-storage";
import { app } from "electron";

export async function getLocal(): Promise<string> {
	try {
		return await generalSettingsStorage.getLanguage();
	} catch {
		return app.getLocale();
	}
}

export async function isChineseLocale(): Promise<boolean> {
	return (await getLocal()).startsWith("zh");
}
