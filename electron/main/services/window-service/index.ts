import type { SheetWindowConfig } from "@shared/types";
import {
	BrowserWindow,
	nativeTheme,
	screen,
	WebContentsView,
	type IpcMainInvokeEvent,
} from "electron";
import windowStateKeeper from "electron-window-state";
import { isNull, isUndefined } from "es-toolkit";
import path from "node:path";
import {
	CONFIG,
	isMac,
	PLATFORM,
	SHELL_WINDOW_FULLSCREEN_CHANGED,
	WINDOW_SIZE,
} from "../../constants";
import { WebContentsFactory } from "../../factories/web-contents-factory";
import {
	withDevToolsShortcuts,
	withExternalLinkHandler,
	withLoadHandlers,
} from "../../mixins/web-contents-mixins";
import { emitter } from "../broadcast-service";
import { ghostWindowService } from "../ghost-window-service";
import { shortcutService } from "../shortcut-service";
import { generalSettingsStorage } from "../storage-service/general-settings-storage";
import { tabStorage } from "../storage-service/tab-storage";
import { tabService } from "../tab-service";

export class WindowService {
	private mainWindowId: number | null = null;
	private windows: BrowserWindow[] = [];
	private isCMDQ = false;
	private settingsWindow: BrowserWindow | null = null;
	private isInitializing = false;

	constructor() {
		emitter.on("general-settings:language-changed", ({ language }) => {
			if (this.settingsWindow) {
				this.settingsWindow.title = language === "zh" ? "设置" : "Settings";
			}
		});
	}

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

	isInitializingWindows(): boolean {
		return this.isInitializing;
	}

	hasAnyWindows(): boolean {
		return this.windows.length > 0;
	}

	async initShellWindows() {
		// Prevent duplicate initialization
		if (this.isInitializing) {
			console.log("[WindowService] Window initialization already in progress, skipping");
			return;
		}

		// Prevent re-initialization if windows already exist
		if (this.windows.length > 0) {
			console.log("[WindowService] Windows already exist, skipping initialization");
			return;
		}

		this.isInitializing = true;
		try {
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
		} finally {
			this.isInitializing = false;
		}
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
			backgroundColor: shouldUseDarkColors ? "#121212" : "#f1f1f1",
			trafficLightPosition: PLATFORM.IS_MAC ? { x: 12, y: 12 } : undefined,
			...(PLATFORM.IS_LINUX && {
				thickFrame: false,
				resizable: true,
				skipTaskbar: false,
			}),
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.cjs"),
				devTools: true,
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
	async handleOpenSettingsWindow(_event: IpcMainInvokeEvent, route?: string): Promise<void> {
		await this.openSettingsWindow(route);
	}

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

			// Focus the tab view
			tabService.focusTabInWindow(targetWindow, tabId);

			// Update storage to set this tab as active
			const tabState = await tabStorage.getItemInternal("tab-bar-state");
			if (!isNull(tabState) && tabState[windowId]) {
				const updatedTabs = tabState[windowId].tabs.map((t) => ({
					...t,
					active: t.id === tabId,
				}));
				tabState[windowId] = { tabs: updatedTabs };
				await tabStorage.setItemInternal("tab-bar-state", tabState);
				console.log(`[WindowService] Activated tab ${tabId} in window ${windowId} via focusWindow`);
			}
		}
	}

	async handleDropAtPointer(
		event: IpcMainInvokeEvent,
		tabId: string,
		pointer: { screenX: number; screenY: number },
	): Promise<
		| { action: "merged"; targetWindowId: string }
		| { action: "detached"; newWindowId: string }
		| null
	> {
		console.log(
			`[WindowService] Dropping tab ${tabId} at pointer (${pointer.screenX}, ${pointer.screenY})`,
		);

		const originWindow = BrowserWindow.fromWebContents(event.sender);
		if (isNull(originWindow)) {
			console.error("[WindowService] Origin window not found");
			return null;
		}

		// Get insert target from ghost window service (synchronous read before stop() clears it)
		const insertTarget = ghostWindowService.getCurrentInsertTargetSync();
		console.log("[WindowService] Using insert target:", insertTarget);

		// Find target window at pointer position
		const targetWindowData = this.findWindowAtPoint(pointer.screenX, pointer.screenY);

		if (targetWindowData) {
			const { win: targetWindow, windowId: targetWindowId } = targetWindowData;

			// Check if pointer is in titlebar area and not the same window
			if (
				targetWindowId !== originWindow.id.toString() &&
				this.isPointInTitlebar(targetWindow, pointer.screenX, pointer.screenY)
			) {
				console.log(`[WindowService] Merging tab ${tabId} into window ${targetWindowId}`);

				const toIndex =
					insertTarget?.windowId === targetWindowId ? insertTarget.insertIndex : undefined;
				await this.handleMoveTabIntoExistingWindow(event, tabId, targetWindowId, toIndex);
				return { action: "merged", targetWindowId };
			}
		}

		// Fall back to creating new window
		console.log("[WindowService] No valid drop target found, creating new window");
		const newWindowId = await this.handleSplitShellWindow(event, tabId);
		if (newWindowId) {
			return { action: "detached", newWindowId };
		}
		return null;
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

		// ========== ATOMIC UPDATE: Update both windows in a single transaction ==========
		const tabState = await tabStorage.getItemInternal("tab-bar-state");
		if (isNull(tabState)) return null;

		// Add tab to new window
		const newShellWindowTabs = [{ ...triggerTab, active: true }];
		tabState[newShellWindowId.toString()] = { tabs: newShellWindowTabs };

		// Remove tab from source window and handle active state
		const sourceWindowId = fromWindow.id.toString();
		if (tabState[sourceWindowId]) {
			const sourceTabs = tabState[sourceWindowId].tabs;
			const removedTabIndex = sourceTabs.findIndex((tab) => tab.id === triggerTabId);
			const wasActive = removedTabIndex !== -1 && sourceTabs[removedTabIndex].active;

			const remainingTabs = sourceTabs.filter((tab) => tab.id !== triggerTabId);

			// If the removed tab was active and there are remaining tabs, activate one
			if (wasActive && remainingTabs.length > 0) {
				// Clear all active flags first
				remainingTabs.forEach((tab) => {
					tab.active = false;
				});
				// Activate the tab at the same index, or the last one if index is out of bounds
				const newActiveIndex = Math.min(removedTabIndex, remainingTabs.length - 1);
				remainingTabs[newActiveIndex].active = true;
			}

			tabState[sourceWindowId] = { tabs: remainingTabs };
		}

		// Single atomic write - triggers only ONE sync broadcast
		await tabStorage.setItemInternal("tab-bar-state", tabState);
		console.log(
			`[WindowService] Atomic update: moved tab ${triggerTabId} from window ${sourceWindowId} to window ${newShellWindowId}`,
		);
		// =============================================================================

		// If source window has remaining tabs, activate the new active tab's view
		if (!shouldCloseSourceWindow && tabState[sourceWindowId]?.tabs.length > 0) {
			const newActiveTab = tabState[sourceWindowId].tabs.find((tab) => tab.active);
			if (newActiveTab) {
				tabService.focusTabInWindow(fromWindow, newActiveTab.id);
			}
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
		insertIndex?: number,
	) {
		const fromWindow = BrowserWindow.fromWebContents(event.sender);
		if (isNull(fromWindow)) return;

		const triggerTab = tabService.getTabById(triggerTabId);
		if (isUndefined(triggerTab)) return;

		const targetWindow = BrowserWindow.fromId(parseInt(windowId));
		if (isNull(targetWindow)) return;

		// Check source window tabs from memory (before transfer removes it)
		// Use tabService's in-memory state, not storage (which may already be updated by frontend)
		const sourceWindowTabs = tabService.getWindowTabs(fromWindow.id);
		const shouldCloseSourceWindow = sourceWindowTabs.size === 1;

		// Prepare the moved tab data
		const movedTab = { ...triggerTab, active: true };

		// Transfer the tab to the target window (preserving WebContentsView)
		tabService.transferTabToWindow(fromWindow, targetWindow, triggerTabId, movedTab);

		// ========== ATOMIC UPDATE: Update both windows in a single transaction ==========
		const tabState = await tabStorage.getItemInternal("tab-bar-state");
		if (isNull(tabState)) return;

		const sourceWindowId = fromWindow.id.toString();
		const targetWindowId = windowId;

		// Update target window - add the moved tab at specified index
		const currentTabs = tabState[targetWindowId]?.tabs || [];
		const updatedCurrentTabs = currentTabs.map((tab) => ({ ...tab, active: false }));

		// Insert at specific index or append to end
		let newTargetWindowTabs;
		if (
			typeof insertIndex === "number" &&
			insertIndex >= 0 &&
			insertIndex <= updatedCurrentTabs.length
		) {
			newTargetWindowTabs = [
				...updatedCurrentTabs.slice(0, insertIndex),
				movedTab,
				...updatedCurrentTabs.slice(insertIndex),
			];
		} else {
			newTargetWindowTabs = [...updatedCurrentTabs, movedTab];
		}
		tabState[targetWindowId] = { tabs: newTargetWindowTabs };

		// Update source window - remove the transferred tab and handle active state
		if (tabState[sourceWindowId]) {
			const sourceTabs = tabState[sourceWindowId].tabs;
			const removedTabIndex = sourceTabs.findIndex((tab) => tab.id === triggerTabId);
			const wasActive = removedTabIndex !== -1 && sourceTabs[removedTabIndex].active;

			const remainingTabs = sourceTabs.filter((tab) => tab.id !== triggerTabId);

			// If the removed tab was active and there are remaining tabs, activate one
			if (wasActive && remainingTabs.length > 0) {
				// Clear all active flags first
				remainingTabs.forEach((tab) => {
					tab.active = false;
				});
				// Activate the tab at the same index, or the last one if index is out of bounds
				const newActiveIndex = Math.min(removedTabIndex, remainingTabs.length - 1);
				remainingTabs[newActiveIndex].active = true;
			}

			tabState[sourceWindowId] = { tabs: remainingTabs };
		}

		// Single atomic write - triggers only ONE sync broadcast
		await tabStorage.setItemInternal("tab-bar-state", tabState);
		console.log(
			`[WindowService] Atomic update: moved tab ${triggerTabId} from window ${sourceWindowId} to window ${targetWindowId} at index ${insertIndex}`,
		);
		// =============================================================================

		// If source window has remaining tabs, activate the new active tab's view
		if (!shouldCloseSourceWindow && tabState[sourceWindowId]?.tabs.length > 0) {
			const newActiveTab = tabState[sourceWindowId].tabs.find((tab) => tab.active);
			if (newActiveTab) {
				tabService.focusTabInWindow(fromWindow, newActiveTab.id);
			}
		}

		// Close source window if it has no remaining tabs after transfer
		if (shouldCloseSourceWindow) {
			console.log(
				`Source window ${fromWindow.id} has no remaining tabs after move, closing window`,
			);
			fromWindow.close();
		}
	}

	private findWindowAtPoint(
		screenX: number,
		screenY: number,
	): { win: BrowserWindow; windowId: string } | null {
		const allWindows = BrowserWindow.getAllWindows();

		// Prefer the currently focused window if it contains the point
		const focused = BrowserWindow.getFocusedWindow();
		if (focused && !focused.isDestroyed()) {
			const fb = focused.getBounds();
			const withinFocused =
				screenX >= fb.x &&
				screenX <= fb.x + fb.width &&
				screenY >= fb.y &&
				screenY <= fb.y + fb.height;
			const focusedId = focused.id.toString();
			if (withinFocused && focusedId) {
				return { win: focused, windowId: focusedId };
			}
		}

		// Fall back: scan all windows
		for (const win of allWindows) {
			if (win.isDestroyed()) continue;
			const bounds = win.getBounds();
			const within =
				screenX >= bounds.x &&
				screenX <= bounds.x + bounds.width &&
				screenY >= bounds.y &&
				screenY <= bounds.y + bounds.height;
			if (!within) continue;
			const windowId = win.id.toString();
			if (windowId) return { win, windowId };
		}
		return null;
	}

	private isPointInTitlebar(win: BrowserWindow, x: number, y: number): boolean {
		const bounds = win.getBounds();
		const relativeX = x - bounds.x;
		const relativeY = y - bounds.y;

		const titlebarHeight = CONFIG.TITLE_BAR_OVERLAY.DARK.height;
		return (
			relativeX >= 0 && relativeX <= bounds.width && relativeY >= 0 && relativeY <= titlebarHeight
		);
	}

	async openSettingsWindow(route?: string): Promise<void> {
		const targetRoute = route || "/settings/general-settings";

		// If settings window already exists, focus it and navigate
		if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
			if (this.settingsWindow.isMinimized()) {
				this.settingsWindow.restore();
			}
			this.settingsWindow.focus();

			// Navigate to the specified route
			const view = this.settingsWindow.contentView.children[0];
			if (view instanceof WebContentsView && !view.webContents.isDestroyed()) {
				const baseUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL || "app://localhost";
				const url = MAIN_WINDOW_VITE_DEV_SERVER_URL
					? `${baseUrl}${targetRoute}`
					: `${baseUrl}?route=${targetRoute.slice(1)}`; // Remove leading /
				view.webContents.loadURL(url);
			}
			return;
		}

		const { shouldUseDarkColors } = nativeTheme;
		const language = await generalSettingsStorage.getLanguage();

		// Get the focused window to determine initial size and position
		const focusedWindow = BrowserWindow.getFocusedWindow();
		let windowWidth = 1000;
		let windowHeight = 700;
		let windowX: number | undefined;
		let windowY: number | undefined;

		if (focusedWindow && !focusedWindow.isDestroyed()) {
			const bounds = focusedWindow.getBounds();
			// Use the focused window's size, but ensure it's not smaller than minimum
			windowWidth = Math.max(bounds.width, 800);
			windowHeight = Math.max(bounds.height, 600);

			// Get the display where the focused window is located
			const display = screen.getDisplayNearestPoint({
				x: bounds.x + bounds.width / 2,
				y: bounds.y + bounds.height / 2,
			});

			// Calculate center position on the same screen
			const displayBounds = display.workArea;
			windowX = Math.floor(displayBounds.x + (displayBounds.width - windowWidth) / 2);
			windowY = Math.floor(displayBounds.y + (displayBounds.height - windowHeight) / 2);
		}

		// Create settings window with normal title bar
		this.settingsWindow = new BrowserWindow({
			width: windowWidth,
			height: windowHeight,
			x: windowX,
			y: windowY,
			minWidth: 800,
			minHeight: 600,
			title: language === "zh" ? "设置" : "Settings",
			autoHideMenuBar: true,
			backgroundColor: shouldUseDarkColors ? "#121212" : "#f1f1f1",
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.cjs"),
				devTools: true,
				webgl: true,
				sandbox: false,
				webSecurity: false,
			},
			show: false,
			icon: path.join(import.meta.dirname, "../../renderer/main_window/icon.png"),
		});

		// Create a single view for settings content
		const settingsView = new WebContentsView({
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.cjs"),
				devTools: true,
				sandbox: false,
				webSecurity: false,
				additionalArguments: [`--theme=${shouldUseDarkColors ? "dark" : "light"}`],
			},
		});

		// Set background color to match theme
		settingsView.setBackgroundColor(shouldUseDarkColors ? "#121212" : "#f1f1f1");

		this.settingsWindow.contentView.addChildView(settingsView);
		const { width, height } = this.settingsWindow.getContentBounds();
		settingsView.setBounds({
			x: 0,
			y: 0,
			width,
			height,
		});

		// Add devTools shortcuts
		withDevToolsShortcuts(settingsView);

		// Add external link handler
		withExternalLinkHandler(settingsView);

		// Load settings page
		const baseUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL || "app://localhost";
		const routePath = MAIN_WINDOW_VITE_DEV_SERVER_URL
			? targetRoute
			: `?route=${targetRoute.slice(1)}`; // Remove leading /

		withLoadHandlers(settingsView, {
			baseUrl,
			routePath,
		});

		settingsView.webContents.once("did-finish-load", () => {
			if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
				this.settingsWindow.show();
			}
		});

		// Handle window resize
		this.settingsWindow.addListener("resize", () => {
			if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
				const bounds = this.settingsWindow.getContentBounds();
				settingsView.setBounds({
					x: 0,
					y: 0,
					width: bounds.width,
					height: bounds.height,
				});
			}
		});

		// Clean up reference when window is closed
		this.settingsWindow.addListener("closed", () => {
			this.settingsWindow = null;
		});
	}
}

export const windowService = new WindowService();
