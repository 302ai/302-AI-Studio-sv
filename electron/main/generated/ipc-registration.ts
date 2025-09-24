import { ipcMain } from "electron";
import { storageService, appService, tabService } from "../services";

/**
 * Auto-generated IPC service interfaces
 */
export function registerIpcHandlers() {
	// storageService service registration
	ipcMain.handle("storageService:setItem", (event, key, value) =>
		storageService.setItem(event, key, value),
	);
	ipcMain.handle("storageService:getItem", (event, key) => storageService.getItem(event, key));
	ipcMain.handle("storageService:hasItem", (event, key) => storageService.hasItem(event, key));
	ipcMain.handle("storageService:removeItem", (event, key, options) =>
		storageService.removeItem(event, key, options),
	);
	ipcMain.handle("storageService:getKeys", (event, base) => storageService.getKeys(event, base));
	ipcMain.handle("storageService:clear", (event, base) => storageService.clear(event, base));
	ipcMain.handle("storageService:getMeta", (event, key) => storageService.getMeta(event, key));
	ipcMain.handle("storageService:setMeta", (event, key, metadata) =>
		storageService.setMeta(event, key, metadata),
	);
	ipcMain.handle("storageService:removeMeta", (event, key) =>
		storageService.removeMeta(event, key),
	);
	ipcMain.handle("storageService:getItems", (event, keys) => storageService.getItems(event, keys));
	ipcMain.handle("storageService:setItems", (event, items) =>
		storageService.setItems(event, items),
	);
	ipcMain.handle("storageService:watch", (event, watchKey) =>
		storageService.watch(event, watchKey),
	);
	ipcMain.handle("storageService:unwatch", (event, watchKey) =>
		storageService.unwatch(event, watchKey),
	);

	// appService service registration
	ipcMain.handle("appService:setTheme", (event, theme) => appService.setTheme(event, theme));

	// tabService service registration
	ipcMain.handle("tabService:handleNewTab", (event, title, type, active) =>
		tabService.handleNewTab(event, title, type, active),
	);
	ipcMain.handle("tabService:handleActivateTab", (event, tabId) =>
		tabService.handleActivateTab(event, tabId),
	);
	ipcMain.handle("tabService:getActiveTab", (event) => tabService.getActiveTab(event));
	ipcMain.handle("tabService:handleTabClose", (event, tabId, newActiveTabId) =>
		tabService.handleTabClose(event, tabId, newActiveTabId),
	);
	ipcMain.handle("tabService:handleTabCloseAll", (event) => tabService.handleTabCloseAll(event));
	ipcMain.handle("tabService:handleShellViewLevel", (event, up) =>
		tabService.handleShellViewLevel(event, up),
	);
}

/**
 * Clean up IPC handlers
 */
export function removeIpcHandlers() {
	ipcMain.removeHandler("storageService:setItem");
	ipcMain.removeHandler("storageService:getItem");
	ipcMain.removeHandler("storageService:hasItem");
	ipcMain.removeHandler("storageService:removeItem");
	ipcMain.removeHandler("storageService:getKeys");
	ipcMain.removeHandler("storageService:clear");
	ipcMain.removeHandler("storageService:getMeta");
	ipcMain.removeHandler("storageService:setMeta");
	ipcMain.removeHandler("storageService:removeMeta");
	ipcMain.removeHandler("storageService:getItems");
	ipcMain.removeHandler("storageService:setItems");
	ipcMain.removeHandler("storageService:watch");
	ipcMain.removeHandler("storageService:unwatch");
	ipcMain.removeHandler("appService:setTheme");
	ipcMain.removeHandler("tabService:handleNewTab");
	ipcMain.removeHandler("tabService:handleActivateTab");
	ipcMain.removeHandler("tabService:getActiveTab");
	ipcMain.removeHandler("tabService:handleTabClose");
	ipcMain.removeHandler("tabService:handleTabCloseAll");
	ipcMain.removeHandler("tabService:handleShellViewLevel");
}
