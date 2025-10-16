import type { SheetWindowConfig } from "@shared/types";
import { BrowserWindow, nativeTheme, WebContentsView, type IpcMainInvokeEvent } from "electron";
import windowStateKeeper from "electron-window-state";
import { isNull, isUndefined } from "es-toolkit";
import path from "node:path";
import {
	CONFIG,
	ENVIRONMENT,
	isMac,
	PLATFORM,
	SHELL_WINDOW_FULLSCREEN_CHANGED,
	WINDOW_SIZE,
} from "../../constants";
import { WebContentsFactory } from "../../factories/web-contents-factory";
import { withDevToolsShortcuts, withLoadHandlers } from "../../mixins/web-contents-mixins";
import { shortcutService } from "../shortcut-service";
import { tabStorage } from "../storage-service/tab-storage";
import { tabService } from "../tab-service";

export class WindowService {
	private mainWindowId: number | null = null;
	private windows: BrowserWindow[] = [];
	private isCMDQ = false;

	// ******************************* Private Methods ******************************* //
	private setMainWindow(windowId: number) {
		this.mainWindowId = windowId;
	}

	private addWindow(window: BrowserWindow) {
		this.windows.push(window);
	}

	private removeWindow(windowId: number) {
		const index = this.windows.findIndex((win) => win.id === windowId);
		if (index !== -1) {
			this.windows.splice(index, 1);
		}
	}

	// ******************************* Public Methods ******************************* //
	getOrderedWindows(): BrowserWindow[] {
		return [...this.windows];
	}

	getMainWindow(): BrowserWindow | null {
		const mainWindow = this.windows.find((win) => win.id === this.mainWindowId);
		if (isUndefined(mainWindow)) {
			console.error("Main window not found");
			return null;
		}
		return mainWindow;
	}

	setCMDQ(value: boolean) {
		this.isCMDQ = value;
	}

	async initShellWindows() {
		const windowsTabs = await tabStorage.getAllWindowsTabs();
		if (isNull(windowsTabs)) {
			const { shellWindow } = await this.createShellWindow();
			this.setMainWindow(shellWindow.id);
			return;
		}

		const windows: BrowserWindow[] = [];
		const newWindowIds: number[] = [];

		for (const [index, tabs] of windowsTabs.entries()) {
			// Skip empty windows
			if (tabs.length === 0) {
				delete windowsTabs[index];
				continue;
			}
			const { shellWindow, shellView } = await this.createShellWindow();
			tabService.initWindowShellView(shellWindow.id, shellView);
			windows.push(shellWindow);
			newWindowIds.push(shellWindow.id);
			await tabService.initWindowTabs(shellWindow, tabs);

			if (index === 0) {
				this.setMainWindow(shellWindow.id);
			}
		}

		await tabStorage.initWindowMapping(newWindowIds, windowsTabs);
	}

	async createShellWindow(
		shellWindowConfig?: SheetWindowConfig,
	): Promise<{ shellWindow: BrowserWindow; shellView: WebContentsView }> {
		const { shouldUseDarkColors } = nativeTheme;

		const mainWindowState = windowStateKeeper({
			defaultWidth: WINDOW_SIZE.MIN_WIDTH,
			defaultHeight: WINDOW_SIZE.MIN_HEIGHT,
			fullScreen: false,
			maximize: false,
		});

		const shellWindow = new BrowserWindow({
			x: shellWindowConfig?.anchor?.x ?? mainWindowState.x,
			y: shellWindowConfig?.anchor?.y ?? mainWindowState.y,
			width: mainWindowState.width,
			height: mainWindowState.height,
			minWidth: WINDOW_SIZE.MIN_WIDTH,
			minHeight: WINDOW_SIZE.MIN_HEIGHT,
			autoHideMenuBar: true,
			transparent: PLATFORM.IS_MAC,
			frame: PLATFORM.IS_LINUX ? false : undefined,
			visualEffectState: "active",
			titleBarStyle: PLATFORM.IS_MAC ? "hiddenInset" : "hidden",
			titleBarOverlay: !PLATFORM.IS_MAC
				? shouldUseDarkColors
					? CONFIG.TITLE_BAR_OVERLAY.DARK
					: CONFIG.TITLE_BAR_OVERLAY.LIGHT
				: undefined,
			backgroundColor: shouldUseDarkColors ? "#2d2d2d" : "#f1f1f1",
			trafficLightPosition: PLATFORM.IS_MAC ? { x: 12, y: 12 } : undefined,
			...(PLATFORM.IS_LINUX && {
				thickFrame: false,
				resizable: true,
				skipTaskbar: false,
			}),
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.cjs"),
				devTools: ENVIRONMENT.IS_DEV,
				webgl: true,
				sandbox: false,
				webSecurity: false,
			},
			roundedCorners: true,
			show: false,
			icon: path.join(import.meta.dirname, "../../renderer/main_window/icon.png"),
		});

		mainWindowState.manage(shellWindow);

		// Create shell view using factory
		const shellWebContentsView = WebContentsFactory.createShellView({
			windowId: shellWindow.id,
			type: "shell",
		});

		// Attach shortcut engine to shell view
		shortcutService.getEngine().attachToView(shellWebContentsView, shellWindow.id, "shell");

		shellWindow.contentView.addChildView(shellWebContentsView);
		const { width, height } = shellWindow.getContentBounds();
		shellWebContentsView.setBounds({
			x: 0,
			y: 0,
			width,
			height,
		});
		shellWebContentsView.setBackgroundColor("#00000000");

		// Add devTools shortcuts
		withDevToolsShortcuts(shellWebContentsView);

		// Add load handlers
		const baseUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL || "app://localhost";
		const routePath = MAIN_WINDOW_VITE_DEV_SERVER_URL
			? `/shell/${shellWindow.id}`
			: `?route=shell/${shellWindow.id}`;

		withLoadHandlers(shellWebContentsView, {
			baseUrl,
			routePath,
			// autoOpenDevTools: !!MAIN_WINDOW_VITE_DEV_SERVER_URL,
		});
		shellWebContentsView.webContents.once("did-finish-load", () => {
			shellWindow.show();
		});

		this.addWindow(shellWindow);

		shellWindow.addListener("focus", () => {
			console.log(
				`window ${shellWindow.id} focus --- windows: ${this.windows.map((win) => win.id)}`,
			);
		});

		shellWindow.addListener("blur", () => {
			console.log(
				`window ${shellWindow.id} blur --- windows: ${this.windows.map((win) => win.id)}`,
			);
		});

		const syncWindowViews = () => {
			if (shellWindow.isDestroyed()) return;
			setImmediate(() => {
				if (shellWindow.isDestroyed()) return;
				tabService.handleWindowResize(shellWindow);
			});
		};

		const handleFullScreenEvent = (isFullScreen: boolean) => {
			syncWindowViews();
			if (isMac) {
				if (!shellWebContentsView.webContents.isDestroyed()) {
					shellWebContentsView.webContents.send(SHELL_WINDOW_FULLSCREEN_CHANGED, {
						isFullScreen,
					});
				}
			}
		};

		shellWindow.addListener("resize", () => {
			console.log("resize", shellWindow.id);
			syncWindowViews();
		});

		shellWindow.addListener("maximize", syncWindowViews);
		shellWindow.addListener("unmaximize", syncWindowViews);
		shellWindow.addListener("minimize", syncWindowViews);
		shellWindow.addListener("restore", syncWindowViews);
		shellWindow.addListener("enter-full-screen", () => handleFullScreenEvent(true));
		shellWindow.addListener("leave-full-screen", () => handleFullScreenEvent(false));
		shellWindow.addListener("show", syncWindowViews);

		shellWindow.addListener("close", async (e) => {
			e.preventDefault();

			const windowCount = this.windows.length;
			const currentWindowId = shellWindow.id;
			const isMainWindow = this.mainWindowId === currentWindowId;
			const isLastWindow = windowCount === 1;
			const isQuittingApp = this.isCMDQ;

			console.log("closing --->", currentWindowId);
			console.log("isMainWindow --->", isMainWindow);
			console.log("isLastWindow --->", isLastWindow);
			console.log("isQuittingApp --->", isQuittingApp);

			// macOS: Hide the last window instead of closing it (unless quitting with CMD+Q)
			if (isLastWindow && isMac && !isQuittingApp) {
				e.preventDefault();
				shellWindow.hide();
				return;
			}

			// Transfer main window identity if closing main window with other windows remaining
			if (windowCount > 1 && isMainWindow) {
				const filteredWindows = this.windows.filter((win) => win.id !== currentWindowId);
				const successorWindowId = filteredWindows.length > 0 ? filteredWindows[0].id : null;
				if (successorWindowId) {
					this.setMainWindow(successorWindowId);
				}
			}

			// Clean up window data (skip cleanup when quitting app as entire app will exit)
			// BUT always clean up private chat data even when closing last window
			const shouldCleanup = !isQuittingApp && (!isMainWindow || windowCount > 1);
			const shouldCleanupPrivateChats = !isQuittingApp; // Always cleanup private chats unless quitting entire app

			if (shouldCleanup) {
				console.log("shouldCleanup ---", true);
				await tabService.removeWindowTabs(currentWindowId);
				await tabStorage.removeWindowState(currentWindowId.toString());
			} else if (shouldCleanupPrivateChats) {
				console.log("shouldCleanupPrivateChats ---", true);
				// Only cleanup private chat data, don't remove window state
				await tabService.cleanupPrivateChatData(currentWindowId);
			}

			shellWindow.destroy();
		});

		shellWindow.addListener("closed", () => {
			console.log("window closed, id: ", shellWindow.id);
			this.removeWindow(shellWindow.id);
		});

		return { shellWindow, shellView: shellWebContentsView };
	}

	// ******************************* IPC Methods ******************************* //
	async focusWindow(_event: IpcMainInvokeEvent, windowId: string, tabId?: string): Promise<void> {
		const numericWindowId = Number.parseInt(windowId, 10);
		if (Number.isNaN(numericWindowId)) return;

		const targetWindow = BrowserWindow.fromId(numericWindowId);
		if (isNull(targetWindow) || targetWindow.isDestroyed()) return;

		if (targetWindow.isMinimized()) {
			targetWindow.restore();
		}

		if (!targetWindow.isVisible()) {
			targetWindow.show();
		}

		targetWindow.focus();

		if (tabId) {
			const tab = tabService.getTabById(tabId);
			if (isUndefined(tab)) return;

			tabService.focusTabInWindow(targetWindow, tabId);
		}
	}

	async handleSplitShellWindow(
		event: IpcMainInvokeEvent,
		triggerTabId: string,
	): Promise<string | null> {
		const fromWindow = BrowserWindow.fromWebContents(event.sender);
		if (isNull(fromWindow)) return null;
		const triggerTab = tabService.getTabById(triggerTabId);
		if (isUndefined(triggerTab)) return null;

		const sourceWindowTabs = tabService.getWindowTabs(fromWindow.id);
		const shouldCloseSourceWindow = sourceWindowTabs.size === 1;

		const { shellWindow, shellView } = await this.createShellWindow();
		const newShellWindowId = shellWindow.id;

		tabService.initWindowShellView(newShellWindowId, shellView);
		tabService.transferTabToWindow(fromWindow, shellWindow, triggerTabId, triggerTab);

		const newShellWindowTabs = [{ ...triggerTab, active: true }];
		await tabStorage.updateWindowTabs(newShellWindowId.toString(), newShellWindowTabs);

		// Update source window storage to remove the transferred tab
		// This prevents the tab from being destroyed when the source window closes
		const sourceTabs = await tabStorage.getTabs(fromWindow.id.toString());
		if (!isNull(sourceTabs)) {
			const remainingTabs = sourceTabs.filter((tab) => tab.id !== triggerTabId);
			await tabStorage.updateWindowTabs(fromWindow.id.toString(), remainingTabs);
		}

		if (shouldCloseSourceWindow) {
			fromWindow.close();
		}

		return newShellWindowId.toString();
	}

	async handleMoveTabIntoExistingWindow(
		event: IpcMainInvokeEvent,
		triggerTabId: string,
		windowId: string,
	) {
		const fromWindow = BrowserWindow.fromWebContents(event.sender);
		if (isNull(fromWindow)) return;

		const triggerTab = tabService.getTabById(triggerTabId);
		if (isUndefined(triggerTab)) return;

		const targetWindow = BrowserWindow.fromId(parseInt(windowId));
		if (isNull(targetWindow)) return;

		const currentTabs = await tabStorage.getTabs(windowId);
		if (isNull(currentTabs)) return;

		// Check source window tabs from memory (before transfer removes it)
		// Use tabService's in-memory state, not storage (which may already be updated by frontend)
		const sourceWindowTabs = tabService.getWindowTabs(fromWindow.id);
		const shouldCloseSourceWindow = sourceWindowTabs.size === 1;

		// Prepare the moved tab data
		const movedTab = { ...triggerTab, active: true };

		// Transfer the tab to the target window (preserving WebContentsView)
		tabService.transferTabToWindow(fromWindow, targetWindow, triggerTabId, movedTab);

		// Update tab storage for the target window
		const updatedCurrentTabs = currentTabs.map((tab) => ({ ...tab, active: false }));
		const newTargetWindowTabs = [...updatedCurrentTabs, movedTab];
		await tabStorage.updateWindowTabs(windowId, newTargetWindowTabs);

		// Update source window storage to remove the transferred tab
		// This prevents the tab from being destroyed when the source window closes
		const sourceTabs = await tabStorage.getTabs(fromWindow.id.toString());
		if (!isNull(sourceTabs)) {
			const remainingTabs = sourceTabs.filter((tab) => tab.id !== triggerTabId);
			await tabStorage.updateWindowTabs(fromWindow.id.toString(), remainingTabs);
		}

		// Close source window if it has no remaining tabs after transfer
		if (shouldCloseSourceWindow) {
			console.log(
				`Source window ${fromWindow.id} has no remaining tabs after move, closing window`,
			);
			fromWindow.close();
		}
	}
}

export const windowService = new WindowService();
