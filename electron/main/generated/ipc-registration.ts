import { ipcMain } from "electron";
import {
	storageService,
	appService,
	broadcastService,
	threadService,
	tabService,
	windowService,
} from "../services";

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

	// broadcastService service registration
	ipcMain.handle("broadcastService:broadcastExcludeSource", (event, broadcastEvent, data) =>
		broadcastService.broadcastExcludeSource(event, broadcastEvent, data),
	);
	ipcMain.handle("broadcastService:broadcastToAll", (event, broadcastEvent, data) =>
		broadcastService.broadcastToAll(event, broadcastEvent, data),
	);

	// threadService service registration
	ipcMain.handle("threadService:addThread", (event, threadId) =>
		threadService.addThread(event, threadId),
	);
	ipcMain.handle("threadService:getThreads", (event) => threadService.getThreads(event));
	ipcMain.handle("threadService:getThread", (event, threadId) =>
		threadService.getThread(event, threadId),
	);
	ipcMain.handle("threadService:deleteThread", (event, threadId) =>
		threadService.deleteThread(event, threadId),
	);
	ipcMain.handle("threadService:renameThread", (event, threadId, newName) =>
		threadService.renameThread(event, threadId, newName),
	);

	// tabService service registration
	ipcMain.handle("tabService:handleNewTabWithThread", (event, threadId, title, type, active) =>
		tabService.handleNewTabWithThread(event, threadId, title, type, active),
	);
	ipcMain.handle("tabService:handleNewTab", (event, title, type, active, href) =>
		tabService.handleNewTab(event, title, type, active, href),
	);
	ipcMain.handle("tabService:handleActivateTab", (event, tabId) =>
		tabService.handleActivateTab(event, tabId),
	);
	ipcMain.handle("tabService:getActiveTab", (event) => tabService.getActiveTab(event));
	ipcMain.handle("tabService:handleTabClose", (event, tabId, newActiveTabId) =>
		tabService.handleTabClose(event, tabId, newActiveTabId),
	);
	ipcMain.handle("tabService:handleTabCloseOthers", (event, tabId, tabIdsToClose) =>
		tabService.handleTabCloseOthers(event, tabId, tabIdsToClose),
	);
	ipcMain.handle(
		"tabService:handleTabCloseOffside",
		(event, tabId, tabIdsToClose, _remainingTabIds, shouldSwitchActive) =>
			tabService.handleTabCloseOffside(
				event,
				tabId,
				tabIdsToClose,
				_remainingTabIds,
				shouldSwitchActive,
			),
	);
	ipcMain.handle("tabService:handleTabCloseAll", (event) => tabService.handleTabCloseAll(event));
	ipcMain.handle("tabService:handleShellViewLevel", (event, up) =>
		tabService.handleShellViewLevel(event, up),
	);

	// windowService service registration
	ipcMain.handle("windowService:focusWindow", (event, windowId, tabId) =>
		windowService.focusWindow(event, windowId, tabId),
	);
	ipcMain.handle("windowService:handleSplitShellWindow", (event, triggerTabId) =>
		windowService.handleSplitShellWindow(event, triggerTabId),
	);
	ipcMain.handle("windowService:handleMoveTabIntoExistingWindow", (event, triggerTabId, windowId) =>
		windowService.handleMoveTabIntoExistingWindow(event, triggerTabId, windowId),
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
	ipcMain.removeHandler("broadcastService:broadcastExcludeSource");
	ipcMain.removeHandler("broadcastService:broadcastToAll");
	ipcMain.removeHandler("threadService:addThread");
	ipcMain.removeHandler("threadService:getThreads");
	ipcMain.removeHandler("threadService:getThread");
	ipcMain.removeHandler("threadService:deleteThread");
	ipcMain.removeHandler("threadService:renameThread");
	ipcMain.removeHandler("tabService:handleNewTabWithThread");
	ipcMain.removeHandler("tabService:handleNewTab");
	ipcMain.removeHandler("tabService:handleActivateTab");
	ipcMain.removeHandler("tabService:getActiveTab");
	ipcMain.removeHandler("tabService:handleTabClose");
	ipcMain.removeHandler("tabService:handleTabCloseOthers");
	ipcMain.removeHandler("tabService:handleTabCloseOffside");
	ipcMain.removeHandler("tabService:handleTabCloseAll");
	ipcMain.removeHandler("tabService:handleShellViewLevel");
	ipcMain.removeHandler("windowService:focusWindow");
	ipcMain.removeHandler("windowService:handleSplitShellWindow");
	ipcMain.removeHandler("windowService:handleMoveTabIntoExistingWindow");
}
