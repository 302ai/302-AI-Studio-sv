import { ipcMain } from "electron";
import { AttachmentsService, AppService } from "../services";

/**
 * Auto-generated IPC service interfaces
 */
export function registerIpcHandlers() {
	// attachments service registration
	const attachmentsInstance = new AttachmentsService();
	ipcMain.handle("attachments:openExternal", (event, url) =>
		attachmentsInstance.openExternal(event, url),
	);
	ipcMain.handle("attachments:openExternal2", (event, url) =>
		attachmentsInstance.openExternal2(event, url),
	);
	ipcMain.handle("attachments:openExternal3", (event, url) =>
		attachmentsInstance.openExternal3(event, url),
	);
	ipcMain.handle("attachments:openExternal4", (event, url) =>
		attachmentsInstance.openExternal4(event, url),
	);

	// app service registration
	const appInstance = new AppService();
	ipcMain.handle("app:setTheme", (event, theme) => appInstance.setTheme(event, theme));
	ipcMain.handle("app:getCurrentTheme", (event) => appInstance.getCurrentTheme(event));
}

/**
 * Clean up IPC handlers
 */
export function removeIpcHandlers() {
	ipcMain.removeHandler("attachments:openExternal");
	ipcMain.removeHandler("attachments:openExternal2");
	ipcMain.removeHandler("attachments:openExternal3");
	ipcMain.removeHandler("attachments:openExternal4");
	ipcMain.removeHandler("app:setTheme");
	ipcMain.removeHandler("app:getCurrentTheme");
}
