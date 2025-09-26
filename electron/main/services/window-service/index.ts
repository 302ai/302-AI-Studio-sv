import type { SheetWindowConfig } from "@shared/types";
import { BrowserWindow, nativeTheme, WebContentsView, type IpcMainInvokeEvent } from "electron";
import windowStateKeeper from "electron-window-state";
import { isNull, isUndefined } from "es-toolkit";
import path from "node:path";
import { CONFIG, ENVIRONMENT, isMac, PLATFORM, WINDOW_SIZE } from "../../constants";
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
			},
			roundedCorners: true,
			show: false,
			icon: path.join(import.meta.dirname, "../../renderer/main_window/icon.png"),
		});

		mainWindowState.manage(shellWindow);

		const shellWebContentsView = new WebContentsView({
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.cjs"),
				devTools: ENVIRONMENT.IS_DEV,
				webgl: true,
				additionalArguments: [`--window-id=${shellWindow.id.toString()}`],
				sandbox: false,
			},
		});
		shellWindow.contentView.addChildView(shellWebContentsView);
		const { width, height } = shellWindow.getContentBounds();
		shellWebContentsView.setBounds({
			x: 0,
			y: 0,
			width: width,
			height: height,
		});
		shellWebContentsView.setBackgroundColor("#00000000");

		if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
			shellWebContentsView.webContents.loadURL(
				MAIN_WINDOW_VITE_DEV_SERVER_URL + `/shell/${shellWindow.id}`,
			);
			shellWebContentsView.webContents.once("did-frame-finish-load", () => {
				shellWebContentsView.webContents.openDevTools({ mode: "detach" });
			});
		} else {
			shellWebContentsView.webContents.loadURL(`app://localhost?route=shell/${shellWindow.id}`);
		}
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

		shellWindow.addListener("resize", () => {
			console.log("resize", shellWindow.id);
			tabService.handleWindowResize(shellWindow);
		});

		shellWindow.addListener("close", async (e) => {
			const windowCount = this.windows.length;
			const currentWindowId = shellWindow.id;
			const isMainWindow = this.mainWindowId === currentWindowId;
			const isLastWindow = windowCount === 1;
			const isQuittingApp = this.isCMDQ;

			console.log("close", windowCount, currentWindowId, isMainWindow);

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
			const shouldCleanup = !isQuittingApp && (!isMainWindow || windowCount > 1);
			if (shouldCleanup) {
				await tabService.removeWindowTabs(currentWindowId);
				tabStorage.removeWindowState(currentWindowId.toString());
			}
		});

		shellWindow.addListener("closed", () => {
			console.log("window closed", shellWindow.id);
			this.removeWindow(shellWindow.id);
		});

		return { shellWindow, shellView: shellWebContentsView };
	}

	// ******************************* IPC Methods ******************************* //
	async handleSplitShellWindow(event: IpcMainInvokeEvent, triggerTabId: string) {
		const fromWindow = BrowserWindow.fromWebContents(event.sender);
		if (isNull(fromWindow)) return;
		const triggerTab = tabService.getTabById(triggerTabId);
		if (isUndefined(triggerTab)) return;

		tabService.transferTabToNewWindow(fromWindow.id, triggerTabId);

		const { shellWindow, shellView } = await this.createShellWindow();
		const newShellWindowId = shellWindow.id;
		const newShellWindowTabs = [triggerTab];
		await tabStorage.updateWindowTabs(newShellWindowId.toString(), newShellWindowTabs);
		tabService.initWindowShellView(newShellWindowId, shellView);
		await tabService.initWindowTabs(shellWindow, newShellWindowTabs);
	}
}

export const windowService = new WindowService();
