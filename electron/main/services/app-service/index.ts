import { nativeTheme, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import type { Theme } from "@shared/types";
import { PLATFORM, CONFIG } from "../../constants";

export class AppService {
	constructor() {
		nativeTheme.on("updated", () => {
			this.updateTitleBarOverlay();
		});
	}
	async setTheme(_event: IpcMainInvokeEvent, theme: Theme): Promise<void> {
		nativeTheme.themeSource = theme;
		BrowserWindow.getAllWindows().forEach((window) => {
			window.webContents.send("theme:set", theme);
		});
	}

	async getCurrentTheme(_event: IpcMainInvokeEvent): Promise<Theme> {
		return nativeTheme.themeSource as Theme;
	}

	private updateTitleBarOverlay() {
		if (!PLATFORM.IS_WINDOWS && !PLATFORM.IS_LINUX) return;

		BrowserWindow.getAllWindows().forEach((window) => {
			window.setTitleBarOverlay(
				nativeTheme.shouldUseDarkColors
					? CONFIG.TITLE_BAR_OVERLAY.DARK
					: CONFIG.TITLE_BAR_OVERLAY.LIGHT,
			);
		});
	}
}

export const appService = new AppService();
