import type { SheetWindowConfig, Tab } from "@shared/types";
import { BrowserWindow, nativeTheme, WebContentsView, type IpcMainInvokeEvent } from "electron";
import windowStateKeeper from "electron-window-state";
import { isNull } from "es-toolkit";
import path from "node:path";
import { CONFIG, ENVIRONMENT, PLATFORM, WINDOW_SIZE } from "../../constants";
import { tabStorage } from "../storage-service/tab-storage";
import { tabService } from "../tab-service";

export class WindowService {
	async initShellWindows() {
		const windowsTabs = await tabStorage.getAllWindowsTabs();
		if (isNull(windowsTabs)) {
			await this.createSheetWindow();
			return;
		}

		const windows: BrowserWindow[] = [];
		const newWindowIds: number[] = [];
		const updatedWindowsTabs: Tab[][] = [];
		for (const tabs of windowsTabs) {
			const { shellWindow, shellView } = await this.createSheetWindow();
			tabService.initWindowShellView(shellWindow.id, shellView);
			windows.push(shellWindow);
			newWindowIds.push(shellWindow.id);
			const updatedTabs = await tabService.initWindowTabs(shellWindow, tabs);
			updatedWindowsTabs.push(updatedTabs);
		}

		await tabStorage.updateWindowMapping(newWindowIds, updatedWindowsTabs);

		windows.forEach((window) => window.show());
	}

	async createSheetWindow(
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
				preload: path.join(import.meta.dirname, "../preload/index.js"),
				devTools: ENVIRONMENT.IS_DEV,
				webgl: true,
			},
			roundedCorners: true,
			show: false,
		});

		mainWindowState.manage(shellWindow);

		const shellWebContentsView = new WebContentsView({
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.js"),
				devTools: ENVIRONMENT.IS_DEV,
				webgl: true,
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
			shellWebContentsView.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL + "/shell");
			shellWebContentsView.webContents.on("did-frame-finish-load", () => {
				shellWebContentsView.webContents.openDevTools({ mode: "detach" });
			});
		} else {
			shellWebContentsView.webContents.loadURL("app://localhost/shell");
		}

		return { shellWindow, shellView: shellWebContentsView };
	}

	async getWindowsId(event: IpcMainInvokeEvent): Promise<string | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return null;
		return window.id.toString();
	}
}

export const windowService = new WindowService();
