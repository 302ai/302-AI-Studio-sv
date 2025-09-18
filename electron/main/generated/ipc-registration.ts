import { ipcMain } from "electron";
import { appService, deviceService, storageService } from "../services";

/**
 * Auto-generated IPC service interfaces
 */
export function registerIpcHandlers() {
	// appService service registration
	ipcMain.handle("appService:setTheme", (event, theme) => appService.setTheme(event, theme));
	ipcMain.handle("appService:getCurrentTheme", (event) => appService.getCurrentTheme(event));

	// deviceService service registration
	ipcMain.handle("deviceService:getPlatform", (event) => deviceService.getPlatform(event));

	// storageService service registration
	ipcMain.handle("storageService:getItem", (event, key) => storageService.getItem(event, key));
	ipcMain.handle("storageService:setItem", (event, key, value) =>
		storageService.setItem(event, key, value),
	);
	ipcMain.handle("storageService:removeItem", (event, key) =>
		storageService.removeItem(event, key),
	);
	ipcMain.handle("storageService:clear", (event) => storageService.clear(event));
	ipcMain.handle("storageService:key", (event, index) => storageService.key(event, index));
	ipcMain.handle("storageService:length", (event) => storageService.length(event));
	ipcMain.handle("storageService:keys", (event) => storageService.keys(event));
}

/**
 * Clean up IPC handlers
 */
export function removeIpcHandlers() {
	ipcMain.removeHandler("appService:setTheme");
	ipcMain.removeHandler("appService:getCurrentTheme");
	ipcMain.removeHandler("deviceService:getPlatform");
	ipcMain.removeHandler("storageService:getItem");
	ipcMain.removeHandler("storageService:setItem");
	ipcMain.removeHandler("storageService:removeItem");
	ipcMain.removeHandler("storageService:clear");
	ipcMain.removeHandler("storageService:key");
	ipcMain.removeHandler("storageService:length");
	ipcMain.removeHandler("storageService:keys");
}
