import { ipcMain } from "electron";
import { AppService, DeviceService } from "../services";

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
}

/**
 * Clean up IPC handlers
 */
export function removeIpcHandlers() {
	ipcMain.removeHandler("appService:setTheme");
	ipcMain.removeHandler("appService:getCurrentTheme");
	ipcMain.removeHandler("deviceService:getPlatform");
}
