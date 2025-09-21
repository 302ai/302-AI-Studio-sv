import type { SheetWindowConfig } from "@shared/types";
import { BrowserWindow, nativeTheme, type IpcMainInvokeEvent } from "electron";
import windowStateKeeper from "electron-window-state";
import path from "node:path";
import { CONFIG, ENVIRONMENT, PLATFORM, WINDOW_SIZE } from "../../constants";

export class WindowService {
	private windowMap: Map<number, BrowserWindow>;

	constructor() {
		this.windowMap = new Map();
	}

	async createSheetWindow(shellWindowConfig?: SheetWindowConfig) {
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
		});

		this.windowMap.set(shellWindow.id, shellWindow);
		mainWindowState.manage(shellWindow);

		if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
			shellWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL + "/shell");
			shellWindow.webContents.on("did-frame-finish-load", () => {
				shellWindow.webContents.openDevTools({ mode: "detach" });
			});
		} else {
			shellWindow.loadURL("app://localhost/shell");
		}
	}

	async getWindowsId(event: IpcMainInvokeEvent): Promise<string | null> {
		const window = BrowserWindow.fromWebContents(event.sender);
		if (!window) return null;
		return window.id.toString();
	}
}

export const windowService = new WindowService();
