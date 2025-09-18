import { ipcMain } from "electron";
import { AppService, DeviceService, StorageService } from "../services";

/**
 * Auto-generated IPC service interfaces
 */
export function registerIpcHandlers() {
	// appService service registration
	const appServiceInstance = new AppService();
	ipcMain.handle("appService:setTheme", (event, theme) =>
		appServiceInstance.setTheme(event, theme),
	);
	ipcMain.handle("appService:getCurrentTheme", (event) =>
		appServiceInstance.getCurrentTheme(event),
	);

	// deviceService service registration
	const deviceServiceInstance = new DeviceService();
	ipcMain.handle("deviceService:getPlatform", (event) => deviceServiceInstance.getPlatform(event));

	// storageService service registration
	const storageServiceInstance = new StorageService();
	ipcMain.handle("storageService:getItem", (event, key) =>
		storageServiceInstance.getItem(event, key),
	);
	ipcMain.handle("storageService:setItem", (event, key, value) =>
		storageServiceInstance.setItem(event, key, value),
	);
	ipcMain.handle("storageService:removeItem", (event, key) =>
		storageServiceInstance.removeItem(event, key),
	);
	ipcMain.handle("storageService:clear", (event) => storageServiceInstance.clear(event));
	ipcMain.handle("storageService:key", (event, index) => storageServiceInstance.key(event, index));
	ipcMain.handle("storageService:length", (event) => storageServiceInstance.length(event));
	ipcMain.handle("storageService:keys", (event) => storageServiceInstance.keys(event));
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
