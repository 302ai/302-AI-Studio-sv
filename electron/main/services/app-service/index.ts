import type { IpcMainInvokeEvent } from "electron";
import { nativeTheme, BrowserWindow } from "electron";
import type { Theme } from "@shared/types";

// Trigger IPC regeneration - test dynamic import paths

export class AppService {
	async setTheme(_event: IpcMainInvokeEvent, theme: Theme): Promise<void> {
		nativeTheme.themeSource = theme;
		BrowserWindow.getAllWindows().forEach((window) => {
			window.webContents.send("theme:set", theme);
		});
	}

	async getCurrentTheme(_event: IpcMainInvokeEvent): Promise<Theme> {
		return nativeTheme.themeSource as Theme;
	}
}

export const appService = new AppService();
