/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow, ipcMain, nativeTheme, net, protocol } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import windowStateKeeper from "electron-window-state";
import { PLATFORM, ENVIRONMENT, WINDOW_SIZE } from "../constants";
import type { Theme } from "../shared/types";
import { CONFIG } from "../constants";
import { initMainBridge } from "../bridge";
const { shouldUseDarkColors } = nativeTheme;
protocol.registerSchemesAsPrivileged([
	{ scheme: "app", privileges: { standard: true, secure: true } },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
	app.quit();
}

function updateTitleBarOverlay() {
	if (!PLATFORM.IS_WINDOWS && !PLATFORM.IS_LINUX) return;

	BrowserWindow.getAllWindows().forEach((window) => {
		window.setTitleBarOverlay(
			nativeTheme.shouldUseDarkColors
				? CONFIG.TITLE_BAR_OVERLAY.DARK
				: CONFIG.TITLE_BAR_OVERLAY.LIGHT,
		);
	});
}

const createWindow = () => {
	const mainWindowState = windowStateKeeper({
		defaultWidth: WINDOW_SIZE.MIN_WIDTH,
		defaultHeight: WINDOW_SIZE.MIN_HEIGHT,
		fullScreen: false,
		maximize: false,
	});
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		x: mainWindowState.x,
		y: mainWindowState.y,
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
			sandbox: false,
			devTools: ENVIRONMENT.IS_DEV,
			webgl: true,
		},
		roundedCorners: true,
	});

	mainWindowState.manage(mainWindow);
	nativeTheme.on("updated", () => {
		updateTitleBarOverlay();
	});

	ipcMain.on("app:theme:setTheme", (event, theme: Theme) => {
		nativeTheme.themeSource = theme;
		mainWindow.webContents.send("app:theme:setTheme", theme);
	});

	ipcMain.handle("app:theme:getCurrentTheme", () => {
		return nativeTheme.themeSource;
	});

	// and load the index.html of the app.
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
		mainWindow.webContents.on("did-frame-finish-load", () => {
			mainWindow.webContents.openDevTools({ mode: "detach" });
		});
	} else {
		mainWindow.loadURL("app://localhost");
	}
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
	// Initialize the bridge for IPC communication
	initMainBridge();

	protocol.handle("app", (request) => {
		const url = new URL(request.url);
		const filePath = url.pathname.substring(1); // 移除开头的 /

		if (!filePath || filePath === "localhost") {
			return net.fetch(
				`file://${path.join(import.meta.dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}`,
			);
		}

		return net.fetch(
			`file://${path.join(import.meta.dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}`, filePath)}`,
		);
	});
	createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
