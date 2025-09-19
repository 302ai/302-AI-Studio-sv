import { nativeTheme, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import type { Theme, ThemeState } from "@shared/types";
import { CONFIG } from "../../constants";
import { storageService } from "../storage-service";

export class AppService {
	async initFromStorage() {
		const state = (await storageService.getItemInternal("app-theme-state")) as ThemeState | null;
		console.log(`state = ${JSON.stringify(state)}, ${typeof state}`);

		if (state == null) {
			console.warn("Unable to laod themeState from storage");
			return;
		}

		nativeTheme.themeSource = state.theme;
	}
	async setTheme(_event: IpcMainInvokeEvent, theme: Theme): Promise<void> {
		console.log("settheme");
		nativeTheme.themeSource = theme;
		const allWindows = BrowserWindow.getAllWindows();
		allWindows.forEach((window) => {
			window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#1A1A1A" : "#F9F9F9");
			window.setTitleBarOverlay(
				nativeTheme.shouldUseDarkColors
					? CONFIG.TITLE_BAR_OVERLAY.DARK
					: CONFIG.TITLE_BAR_OVERLAY.LIGHT,
			);
		});
	}
}

export const appService = new AppService();
