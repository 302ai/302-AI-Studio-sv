import type { SheetWindowConfig } from "@shared/types";
import windowStateKeeper from "electron-window-state";
import { WINDOW_SIZE, PLATFORM, ENVIRONMENT, CONFIG } from "../../constants";
import { BrowserWindow, nativeTheme } from "electron";
import path from "node:path";

export class WindowService {
	windowMap: Map<number, BrowserWindow>;

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
			shellWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
			shellWindow.webContents.on("did-frame-finish-load", () => {
				shellWindow.webContents.openDevTools({ mode: "detach" });
			});
		} else {
			shellWindow.loadURL("app://localhost");
		}
	}
}

export const windowService = new WindowService();
