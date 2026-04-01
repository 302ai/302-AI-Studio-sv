import type { ShortcutContext } from "@shared/types/shortcut";
import { createLogger } from "@shared/logger";

const logger = createLogger("shortcut");
import { BrowserWindow } from "electron";
import { isNull } from "es-toolkit";
import { aiApplicationService } from "../ai-application-service";
import { tabService } from "../tab-service";
import { windowService } from "../window-service";

export class ShortcutActionsHandler {
	async handle(action: string, ctx: ShortcutContext): Promise<void> {
		const { windowId } = ctx;
		logger.info(`[MainActionsHandler] Received Action: "${action}" (Window: ${windowId})`);

		// Tab-related actions require more than one tab
		const tabRelatedActions = [
			"closeCurrentTab",
			"closeOtherTabs",
			"nextTab",
			"previousTab",
			"switchToTab1",
			"switchToTab2",
			"switchToTab3",
			"switchToTab4",
			"switchToTab5",
			"switchToTab6",
			"switchToTab7",
			"switchToTab8",
			"switchToTab9",
		];

		if (tabRelatedActions.includes(action)) {
			const windowTabs = tabService.getWindowTabs(windowId);
			if (windowTabs.size <= 1) {
				return;
			}
		}

		try {
			switch (action) {
				case "sendMessage":
					await this.handleSendMessage(windowId, ctx);
					break;
				case "newTab":
					await this.handleNewTab(windowId);
					break;
				case "closeCurrentTab":
					await this.handleCloseCurrentTab(windowId);
					break;
				case "closeOtherTabs":
					await this.handleCloseOtherTabs(windowId);
					break;
				case "nextTab":
					await this.handleNextTab(windowId);
					break;
				case "previousTab":
					await this.handlePreviousTab(windowId);
					break;
				case "restoreLastTab":
					break;

				case "switchToTab1":
				case "switchToTab2":
				case "switchToTab3":
				case "switchToTab4":
				case "switchToTab5":
				case "switchToTab6":
				case "switchToTab7":
				case "switchToTab8":
				case "switchToTab9":
					await this.handleSwitchToTab(windowId, action);
					break;

				case "openSettings":
					await this.handleOpenSettings(windowId);
					break;
				case "toggleSidebar":
					await this.handleToggleSidebar(windowId);
					break;
				case "toggleSidebarRight":
					await this.handleToggleSidebarRight(windowId);
					break;
				case "toggleModelPanel":
					await this.handleToggleModelPanel(windowId);
					break;
				case "toggleIncognitoMode":
					await this.handleToggleIncognitoMode(windowId);
					break;
				case "toggleChatParametersPanel":
					await this.handleToggleChatParametersPanel(windowId);
					break;
				case "togglePlanMode":
					await this.handleTogglePlanMode(windowId);
					break;

				case "newChat":
					await this.handleNewChat(windowId);
					break;
				case "clearMessages":
					await this.handleClearMessages(windowId, ctx);
					break;
				case "stopGeneration":
					await this.handleStopGeneration(windowId, ctx);
					break;
				case "regenerateResponse":
					await this.handleRegenerateResponse(windowId, ctx);
					break;
				case "createBranch":
					await this.handleCreateBranch(windowId, ctx);
					break;
				case "branchAndSend":
					await this.handleBranchAndSend(windowId, ctx);
					break;
				case "deleteCurrentThread":
					await this.handleDeleteCurrentThread(windowId, ctx);
					break;
				case "search":
					await this.handleSearch(windowId, ctx);
					break;

				default:
					logger.warn(`Unknown shortcut action: ${action}`);
			}
		} catch (error) {
			logger.error(`Error handling shortcut action ${action}:`, error);
		}
	}

	private async handleSendMessage(windowId: number, ctx: ShortcutContext): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "sendMessage",
				ctx,
			});
		}
	}

	private async handleNewTab(windowId: number): Promise<void> {
		const window = BrowserWindow.fromId(windowId);
		if (isNull(window)) return;

		const shellView = this.getShellViewWebContents(windowId);
		if (shellView && !shellView.isDestroyed()) {
			shellView.send("shortcut:action", {
				action: "newTab",
				ctx: { windowId },
			});
		}
	}

	private async handleCloseCurrentTab(windowId: number): Promise<void> {
		const shellView = this.getShellViewWebContents(windowId);
		if (shellView && !shellView.isDestroyed()) {
			shellView.send("shortcut:action", {
				action: "closeCurrentTab",
				ctx: { windowId },
			});
		}
	}

	private async handleCloseOtherTabs(windowId: number): Promise<void> {
		const shellView = this.getShellViewWebContents(windowId);
		if (shellView && !shellView.isDestroyed()) {
			shellView.send("shortcut:action", {
				action: "closeOtherTabs",
				ctx: { windowId },
			});
		}
	}

	private async handleNextTab(windowId: number): Promise<void> {
		const shellView = this.getShellViewWebContents(windowId);
		if (shellView && !shellView.isDestroyed()) {
			shellView.send("shortcut:action", {
				action: "nextTab",
				ctx: { windowId },
			});
		}
	}

	private async handlePreviousTab(windowId: number): Promise<void> {
		const shellView = this.getShellViewWebContents(windowId);
		if (shellView && !shellView.isDestroyed()) {
			shellView.send("shortcut:action", {
				action: "previousTab",
				ctx: { windowId },
			});
		}
	}

	private async handleSwitchToTab(windowId: number, action: string): Promise<void> {
		const shellView = this.getShellViewWebContents(windowId);
		if (shellView && !shellView.isDestroyed()) {
			shellView.send("shortcut:action", {
				action,
				ctx: { windowId },
			});
		}
	}

	private async handleOpenSettings(_windowId: number): Promise<void> {
		await windowService.openSettingsWindow();
	}

	private async handleToggleSidebar(windowId: number): Promise<void> {
		const activeTabId = tabService.getActiveTabId(windowId);

		if (!activeTabId) {
			logger.info(`[ActionsHandler] No active tab found`);
			return;
		}

		const view = tabService.getTabView(activeTabId);

		if (view && !view.webContents.isDestroyed()) {
			view.webContents.send("shortcut:action", {
				action: "toggleSidebar",
				ctx: { windowId },
			});
		} else {
			logger.info(`[ActionsHandler] Cannot send - view is null or destroyed`);
		}
	}

	private async handleToggleSidebarRight(windowId: number): Promise<void> {
		const activeTabId = tabService.getActiveTabId(windowId);
		if (!activeTabId) {
			logger.info(`[ActionsHandler] No active tab found`);
			return;
		}

		const view = tabService.getTabView(activeTabId);

		if (view && !view.webContents.isDestroyed()) {
			view.webContents.send("shortcut:action", {
				action: "toggleSidebarRight",
				ctx: { windowId },
			});
		} else {
			logger.info(`[ActionsHandler] Cannot send - view is null or destroyed`);
		}
	}

	private async handleToggleModelPanel(windowId: number): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "toggleModelPanel",
				ctx: { windowId },
			});
		}
	}

	private async handleToggleIncognitoMode(windowId: number): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "toggleIncognitoMode",
				ctx: { windowId },
			});
		}
	}

	private async handleNewChat(windowId: number): Promise<void> {
		const shellView = this.getShellViewWebContents(windowId);
		if (shellView && !shellView.isDestroyed()) {
			shellView.send("shortcut:action", {
				action: "newChat",
				ctx: { windowId },
			});
		}
	}

	private async handleClearMessages(windowId: number, ctx: ShortcutContext): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "clearMessages",
				ctx,
			});
		}
	}

	private async handleStopGeneration(windowId: number, ctx: ShortcutContext): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "stopGeneration",
				ctx,
			});
		}
	}

	private async handleRegenerateResponse(windowId: number, ctx: ShortcutContext): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "regenerateResponse",
				ctx,
			});
		} else {
			// For tool view
			logger.info("handleRegenerateResponse - activeView is null or destroyed");
			await aiApplicationService.handleAiApplicationReload(windowId);
		}
	}

	private async handleCreateBranch(windowId: number, ctx: ShortcutContext): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "createBranch",
				ctx,
			});
		}
	}

	private async handleBranchAndSend(windowId: number, ctx: ShortcutContext): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "branchAndSend",
				ctx,
			});
		}
	}

	private async handleDeleteCurrentThread(windowId: number, ctx: ShortcutContext): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "deleteCurrentThread",
				ctx,
			});
		}
	}

	private async handleSearch(windowId: number, ctx: ShortcutContext): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "search",
				ctx,
			});
		}
	}

	private async handleToggleChatParametersPanel(windowId: number): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "toggleChatParametersPanel",
				ctx: { windowId },
			});
		}
	}

	private async handleTogglePlanMode(windowId: number): Promise<void> {
		const activeView = this.getActiveTabWebContents(windowId);
		logger.info(
			`[MainActionsHandler] handleTogglePlanMode for Window ${windowId}. Active View: ${activeView ? activeView.id : "None"}`,
		);
		if (activeView && !activeView.isDestroyed()) {
			activeView.send("shortcut:action", {
				action: "togglePlanMode",
				ctx: { windowId },
			});
		}
	}

	private getShellViewWebContents(windowId: number): Electron.WebContents | null {
		const shellView = tabService.getShellView(windowId);
		if (!shellView || shellView.webContents.isDestroyed()) return null;
		return shellView.webContents;
	}

	private getActiveTabWebContents(windowId: number): Electron.WebContents | null {
		const activeTabId = tabService.getActiveTabId(windowId);
		if (!activeTabId) return null;

		const tab = tabService.getTabById(activeTabId);
		if (!tab || tab.type !== "chat") return null;

		const view = tabService.getTabView(activeTabId);
		if (!view || view.webContents.isDestroyed()) return null;

		return view.webContents;
	}
}

export const shortcutActionsHandler = new ShortcutActionsHandler();
