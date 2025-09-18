import { ipcMain } from "electron";
import { AttachmentsService, WindowService } from "../services";

/**
 * Auto-generated IPC service interfaces
 */
export function registerIpcHandlers() {
	// attachments service registration
	const attachmentsInstance = new AttachmentsService();
	ipcMain.handle("app:attachments:openExternal", (event, url) =>
		attachmentsInstance.openExternal(event, url),
	);
	ipcMain.handle("app:attachments:openExternal2", (event, url) =>
		attachmentsInstance.openExternal2(event, url),
	);
	ipcMain.handle("app:attachments:openExternal3", (event, url) =>
		attachmentsInstance.openExternal3(event, url),
	);
	ipcMain.handle("app:attachments:openExternal4", (event, url) =>
		attachmentsInstance.openExternal4(event, url),
	);

	// window service registration
	const windowInstance = new WindowService();
	ipcMain.handle("app:window:maximize", (event) => windowInstance.maximize(event));
	ipcMain.handle("app:window:minimize", (event) => windowInstance.minimize(event));
	ipcMain.handle("app:window:restore", (event) => windowInstance.restore(event));
	ipcMain.handle("app:window:close", (event) => windowInstance.close(event));
	ipcMain.handle("app:window:getWindowState", (event) => windowInstance.getWindowState(event));
	ipcMain.handle("app:window:setWindowSize", (event, width, height) =>
		windowInstance.setWindowSize(event, width, height),
	);
	ipcMain.handle("app:window:sayHello", (event) => windowInstance.sayHello(event));
}

/**
 * Clean up IPC handlers
 */
export function removeIpcHandlers() {
	ipcMain.removeHandler("app:attachments:openExternal");
	ipcMain.removeHandler("app:attachments:openExternal2");
	ipcMain.removeHandler("app:attachments:openExternal3");
	ipcMain.removeHandler("app:attachments:openExternal4");
	ipcMain.removeHandler("app:window:maximize");
	ipcMain.removeHandler("app:window:minimize");
	ipcMain.removeHandler("app:window:restore");
	ipcMain.removeHandler("app:window:close");
	ipcMain.removeHandler("app:window:getWindowState");
	ipcMain.removeHandler("app:window:setWindowSize");
	ipcMain.removeHandler("app:window:sayHello");
}
