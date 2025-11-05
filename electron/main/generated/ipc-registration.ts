import { ipcMain } from "electron";
import {
	registryService,
	broadcastService,
	storageService,
	pluginService,
	generalSettingsService,
	windowService,
	shortcutService,
	tabService,
	aiApplicationService,
	appService,
	dataService,
	externalLinkService,
	mcpService,
	threadService,
	updaterService,
} from "../services";

/**
 * Auto-generated IPC service interfaces
 */
export function registerIpcHandlers() {
	// registryService service registration
	ipcMain.handle("registryService:getMarketplacePlugins", (event) =>
		registryService.getMarketplacePlugins(event),
	);
	ipcMain.handle("registryService:getMarketplacePlugin", (event, pluginId) =>
		registryService.getMarketplacePlugin(event, pluginId),
	);
	ipcMain.handle("registryService:searchMarketplacePlugins", (event, query) =>
		registryService.searchMarketplacePlugins(event, query),
	);
	ipcMain.handle("registryService:getFeaturedPlugins", (event) =>
		registryService.getFeaturedPlugins(event),
	);
	ipcMain.handle("registryService:refreshRegistry", (event) =>
		registryService.refreshRegistry(event),
	);
	ipcMain.handle("registryService:clearCache", (event) => registryService.clearCache(event));
	ipcMain.handle("registryService:getCacheInfo", (event) => registryService.getCacheInfo(event));

	// broadcastService service registration
	ipcMain.handle("broadcastService:broadcastExcludeSource", (event, broadcastEvent, data) =>
		broadcastService.broadcastExcludeSource(event, broadcastEvent, data),
	);
	ipcMain.handle("broadcastService:broadcastToAll", (event, broadcastEvent, data) =>
		broadcastService.broadcastToAll(event, broadcastEvent, data),
	);

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

	// pluginService service registration
	ipcMain.handle("pluginService:getInstalledPlugins", (event) =>
		pluginService.getInstalledPlugins(event),
	);
	ipcMain.handle("pluginService:getPlugin", (event, pluginId) =>
		pluginService.getPlugin(event, pluginId),
	);
	ipcMain.handle("pluginService:getEnabledPlugins", (event) =>
		pluginService.getEnabledPlugins(event),
	);
	ipcMain.handle("pluginService:getProviderPlugins", (event) =>
		pluginService.getProviderPlugins(event),
	);
	ipcMain.handle("pluginService:enablePlugin", (event, pluginId) =>
		pluginService.enablePlugin(event, pluginId),
	);
	ipcMain.handle("pluginService:disablePlugin", (event, pluginId) =>
		pluginService.disablePlugin(event, pluginId),
	);
	ipcMain.handle("pluginService:installPlugin", (event, source) =>
		pluginService.installPlugin(event, source),
	);
	ipcMain.handle("pluginService:uninstallPlugin", (event, pluginId) =>
		pluginService.uninstallPlugin(event, pluginId),
	);
	ipcMain.handle("pluginService:checkForUpdates", (event, pluginId) =>
		pluginService.checkForUpdates(event, pluginId),
	);
	ipcMain.handle("pluginService:updatePlugin", (event, pluginId) =>
		pluginService.updatePlugin(event, pluginId),
	);
	ipcMain.handle("pluginService:reloadPlugin", (event, pluginId) =>
		pluginService.reloadPlugin(event, pluginId),
	);
	ipcMain.handle("pluginService:selectPluginFolder", (event) =>
		pluginService.selectPluginFolder(event),
	);
	ipcMain.handle("pluginService:getPluginConfig", (event, pluginId) =>
		pluginService.getPluginConfig(event, pluginId),
	);
	ipcMain.handle("pluginService:setPluginConfig", (event, pluginId, config) =>
		pluginService.setPluginConfig(event, pluginId, config),
	);
	ipcMain.handle("pluginService:getPluginConfigValue", (event, pluginId, key) =>
		pluginService.getPluginConfigValue(event, pluginId, key),
	);
	ipcMain.handle("pluginService:setPluginConfigValue", (event, pluginId, key, value) =>
		pluginService.setPluginConfigValue(event, pluginId, key, value),
	);
	ipcMain.handle("pluginService:fetchModelsFromProvider", (event, provider) =>
		pluginService.fetchModelsFromProvider(event, provider),
	);
	ipcMain.handle("pluginService:executeBeforeSendMessageHook", (event, context) =>
		pluginService.executeBeforeSendMessageHook(event, context),
	);
	ipcMain.handle("pluginService:executeAfterSendMessageHook", (event, context, response) =>
		pluginService.executeAfterSendMessageHook(event, context, response),
	);
	ipcMain.handle("pluginService:executeErrorHook", (event, errorData, context) =>
		pluginService.executeErrorHook(event, errorData, context),
	);

	// generalSettingsService service registration
	ipcMain.handle("generalSettingsService:handleLanguageChanged", (event, language) =>
		generalSettingsService.handleLanguageChanged(event, language),
	);

	// windowService service registration
	ipcMain.handle("windowService:handleOpenSettingsWindow", (event, route) =>
		windowService.handleOpenSettingsWindow(event, route),
	);
	ipcMain.handle("windowService:focusWindow", (event, windowId, tabId) =>
		windowService.focusWindow(event, windowId, tabId),
	);
	ipcMain.handle("windowService:handleSplitShellWindow", (event, triggerTabId) =>
		windowService.handleSplitShellWindow(event, triggerTabId),
	);
	ipcMain.handle("windowService:handleMoveTabIntoExistingWindow", (event, triggerTabId, windowId) =>
		windowService.handleMoveTabIntoExistingWindow(event, triggerTabId, windowId),
	);

	// shortcutService service registration
	ipcMain.handle("shortcutService:init", (event, shortcuts) =>
		shortcutService.init(event, shortcuts),
	);
	ipcMain.handle("shortcutService:updateShortcuts", (event, shortcuts) =>
		shortcutService.updateShortcuts(event, shortcuts),
	);
	ipcMain.handle("shortcutService:getConflicts", (event) => shortcutService.getConflicts(event));
	ipcMain.handle("shortcutService:getSyncInfo", (event) => shortcutService.getSyncInfo(event));

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
	ipcMain.handle("tabService:replaceTabContent", (event, tabId, newThreadId) =>
		tabService.replaceTabContent(event, tabId, newThreadId),
	);
	ipcMain.handle("tabService:handleClearTabMessages", (event, tabId, threadId) =>
		tabService.handleClearTabMessages(event, tabId, threadId),
	);
	ipcMain.handle("tabService:handleGenerateTabTitle", (event, tabId, threadId) =>
		tabService.handleGenerateTabTitle(event, tabId, threadId),
	);

	// aiApplicationService service registration
	ipcMain.handle("aiApplicationService:getAiApplicationUrl", (event, applicationId) =>
		aiApplicationService.getAiApplicationUrl(event, applicationId),
	);
	ipcMain.handle("aiApplicationService:handle302AIProviderChange", (event, updatedApiKey) =>
		aiApplicationService.handle302AIProviderChange(event, updatedApiKey),
	);
	ipcMain.handle("aiApplicationService:handleAiApplicationReload", (event, tabId) =>
		aiApplicationService.handleAiApplicationReload(event, tabId),
	);

	// appService service registration
	ipcMain.handle("appService:getTheme", (event) => appService.getTheme(event));
	ipcMain.handle("appService:setTheme", (event, theme) => appService.setTheme(event, theme));
	ipcMain.handle("appService:restartApp", (event) => appService.restartApp(event));
	ipcMain.handle("appService:resetAllData", (event) => appService.resetAllData(event));
	ipcMain.handle("appService:clearChatHistory", (event) => appService.clearChatHistory(event));

	// dataService service registration
	ipcMain.handle("dataService:importLegacyJson", (event) => dataService.importLegacyJson(event));
	ipcMain.handle("dataService:exportStorage", (event) => dataService.exportStorage(event));
	ipcMain.handle("dataService:importStorage", (event) => dataService.importStorage(event));
	ipcMain.handle("dataService:listBackups", (event) => dataService.listBackups(event));
	ipcMain.handle("dataService:restoreFromBackup", (event, backupPath) =>
		dataService.restoreFromBackup(event, backupPath),
	);
	ipcMain.handle("dataService:deleteBackup", (event, backupPath) =>
		dataService.deleteBackup(event, backupPath),
	);
	ipcMain.handle("dataService:openBackupDirectory", (event) =>
		dataService.openBackupDirectory(event),
	);
	ipcMain.handle("dataService:checkOldVersionData", (event) =>
		dataService.checkOldVersionData(event),
	);

	// externalLinkService service registration
	ipcMain.handle("externalLinkService:openExternalLink", (event, url) =>
		externalLinkService.openExternalLink(event, url),
	);

	// mcpService service registration
	ipcMain.handle("mcpService:getToolsFromServer", (event, server) =>
		mcpService.getToolsFromServer(event, server),
	);
	ipcMain.handle("mcpService:closeServer", (event, serverId) =>
		mcpService.closeServer(event, serverId),
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
	ipcMain.handle("threadService:addFavorite", (event, threadId) =>
		threadService.addFavorite(event, threadId),
	);
	ipcMain.handle("threadService:removeFavorite", (event, threadId) =>
		threadService.removeFavorite(event, threadId),
	);

	// updaterService service registration
	ipcMain.handle("updaterService:checkForUpdatesManually", (event) =>
		updaterService.checkForUpdatesManually(event),
	);
	ipcMain.handle("updaterService:quitAndInstall", (event) => updaterService.quitAndInstall(event));
	ipcMain.handle("updaterService:isUpdateDownloaded", (event) =>
		updaterService.isUpdateDownloaded(event),
	);
	ipcMain.handle("updaterService:setAutoUpdate", (event, enabled) =>
		updaterService.setAutoUpdate(event, enabled),
	);
}

/**
 * Clean up IPC handlers
 */
export function removeIpcHandlers() {
	ipcMain.removeHandler("registryService:getMarketplacePlugins");
	ipcMain.removeHandler("registryService:getMarketplacePlugin");
	ipcMain.removeHandler("registryService:searchMarketplacePlugins");
	ipcMain.removeHandler("registryService:getFeaturedPlugins");
	ipcMain.removeHandler("registryService:refreshRegistry");
	ipcMain.removeHandler("registryService:clearCache");
	ipcMain.removeHandler("registryService:getCacheInfo");
	ipcMain.removeHandler("broadcastService:broadcastExcludeSource");
	ipcMain.removeHandler("broadcastService:broadcastToAll");
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
	ipcMain.removeHandler("pluginService:getInstalledPlugins");
	ipcMain.removeHandler("pluginService:getPlugin");
	ipcMain.removeHandler("pluginService:getEnabledPlugins");
	ipcMain.removeHandler("pluginService:getProviderPlugins");
	ipcMain.removeHandler("pluginService:enablePlugin");
	ipcMain.removeHandler("pluginService:disablePlugin");
	ipcMain.removeHandler("pluginService:installPlugin");
	ipcMain.removeHandler("pluginService:uninstallPlugin");
	ipcMain.removeHandler("pluginService:checkForUpdates");
	ipcMain.removeHandler("pluginService:updatePlugin");
	ipcMain.removeHandler("pluginService:reloadPlugin");
	ipcMain.removeHandler("pluginService:selectPluginFolder");
	ipcMain.removeHandler("pluginService:getPluginConfig");
	ipcMain.removeHandler("pluginService:setPluginConfig");
	ipcMain.removeHandler("pluginService:getPluginConfigValue");
	ipcMain.removeHandler("pluginService:setPluginConfigValue");
	ipcMain.removeHandler("pluginService:fetchModelsFromProvider");
	ipcMain.removeHandler("pluginService:executeBeforeSendMessageHook");
	ipcMain.removeHandler("pluginService:executeAfterSendMessageHook");
	ipcMain.removeHandler("pluginService:executeErrorHook");
	ipcMain.removeHandler("generalSettingsService:handleLanguageChanged");
	ipcMain.removeHandler("windowService:handleOpenSettingsWindow");
	ipcMain.removeHandler("windowService:focusWindow");
	ipcMain.removeHandler("windowService:handleSplitShellWindow");
	ipcMain.removeHandler("windowService:handleMoveTabIntoExistingWindow");
	ipcMain.removeHandler("shortcutService:init");
	ipcMain.removeHandler("shortcutService:updateShortcuts");
	ipcMain.removeHandler("shortcutService:getConflicts");
	ipcMain.removeHandler("shortcutService:getSyncInfo");
	ipcMain.removeHandler("tabService:handleNewTabWithThread");
	ipcMain.removeHandler("tabService:handleNewTab");
	ipcMain.removeHandler("tabService:handleActivateTab");
	ipcMain.removeHandler("tabService:getActiveTab");
	ipcMain.removeHandler("tabService:handleTabClose");
	ipcMain.removeHandler("tabService:handleTabCloseOthers");
	ipcMain.removeHandler("tabService:handleTabCloseOffside");
	ipcMain.removeHandler("tabService:handleTabCloseAll");
	ipcMain.removeHandler("tabService:handleShellViewLevel");
	ipcMain.removeHandler("tabService:replaceTabContent");
	ipcMain.removeHandler("tabService:handleClearTabMessages");
	ipcMain.removeHandler("tabService:handleGenerateTabTitle");
	ipcMain.removeHandler("aiApplicationService:getAiApplicationUrl");
	ipcMain.removeHandler("aiApplicationService:handle302AIProviderChange");
	ipcMain.removeHandler("aiApplicationService:handleAiApplicationReload");
	ipcMain.removeHandler("appService:getTheme");
	ipcMain.removeHandler("appService:setTheme");
	ipcMain.removeHandler("appService:restartApp");
	ipcMain.removeHandler("appService:resetAllData");
	ipcMain.removeHandler("appService:clearChatHistory");
	ipcMain.removeHandler("dataService:importLegacyJson");
	ipcMain.removeHandler("dataService:exportStorage");
	ipcMain.removeHandler("dataService:importStorage");
	ipcMain.removeHandler("dataService:listBackups");
	ipcMain.removeHandler("dataService:restoreFromBackup");
	ipcMain.removeHandler("dataService:deleteBackup");
	ipcMain.removeHandler("dataService:openBackupDirectory");
	ipcMain.removeHandler("dataService:checkOldVersionData");
	ipcMain.removeHandler("externalLinkService:openExternalLink");
	ipcMain.removeHandler("mcpService:getToolsFromServer");
	ipcMain.removeHandler("mcpService:closeServer");
	ipcMain.removeHandler("threadService:addThread");
	ipcMain.removeHandler("threadService:getThreads");
	ipcMain.removeHandler("threadService:getThread");
	ipcMain.removeHandler("threadService:deleteThread");
	ipcMain.removeHandler("threadService:renameThread");
	ipcMain.removeHandler("threadService:addFavorite");
	ipcMain.removeHandler("threadService:removeFavorite");
	ipcMain.removeHandler("updaterService:checkForUpdatesManually");
	ipcMain.removeHandler("updaterService:quitAndInstall");
	ipcMain.removeHandler("updaterService:isUpdateDownloaded");
	ipcMain.removeHandler("updaterService:setAutoUpdate");
}
