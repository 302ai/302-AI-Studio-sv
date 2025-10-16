import type { Theme } from "@shared/types";
import { app, BrowserWindow, nativeTheme, type IpcMainInvokeEvent } from "electron";
import { CONFIG, isMac } from "../../constants";
import { themeStorage } from "../storage-service/theme-storage";

export class AppService {
	async initFromStorage() {
		const state = await themeStorage.getThemeState();
		console.log(`state = ${JSON.stringify(state)}, ${typeof state}`);

		if (state === null) {
			console.warn("Unable to load themeState from storage");
			return;
		}

		nativeTheme.themeSource = state.theme;
	}

	async setTheme(_event: IpcMainInvokeEvent, theme: Theme): Promise<void> {
		nativeTheme.themeSource = theme;
		const allWindows = BrowserWindow.getAllWindows();
		allWindows.forEach((window) => {
			window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#1A1A1A" : "#F9F9F9");
			if (!isMac) {
				window.setTitleBarOverlay(
					nativeTheme.shouldUseDarkColors
						? CONFIG.TITLE_BAR_OVERLAY.DARK
						: CONFIG.TITLE_BAR_OVERLAY.LIGHT,
				);
			}
		});
	}

	/**
	 * Restart the entire Electron application
	 */
	async restartApp(_event: IpcMainInvokeEvent): Promise<void> {
		console.log("Restarting application...");
		app.relaunch();
		app.exit(0);
	}
}

export const appService = new AppService();
