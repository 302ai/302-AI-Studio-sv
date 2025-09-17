/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow, nativeImage, nativeTheme, net, protocol } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import windowStateKeeper from "electron-window-state";
import { WINDOW_SIZE } from "./shared/constants";
import { isDev, isLinux, isMac, isWin } from "./constant";
import { titleBarOverlayDark, titleBarOverlayLight } from "./shared/config";
const { shouldUseDarkColors } = nativeTheme;
protocol.registerSchemesAsPrivileged([
	{ scheme: "app", privileges: { standard: true, secure: true } },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
	app.quit();
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
		transparent: isMac,
		frame: isLinux ? false : undefined,
		visualEffectState: "active",
		titleBarStyle: isMac ? "hiddenInset" : "hidden",
		titleBarOverlay: !isMac
			? shouldUseDarkColors
				? titleBarOverlayDark
				: titleBarOverlayLight
			: undefined,
		backgroundColor: shouldUseDarkColors ? "#121212" : "#FFFFFF",
		trafficLightPosition: isMac ? { x: 12, y: 12 } : undefined,
		...(isLinux && {
			thickFrame: false,
			resizable: true,
			skipTaskbar: false,
		}),
		webPreferences: {
			preload: path.join(import.meta.dirname, "preload.js"),
			sandbox: false,
			devTools: isDev,
			webgl: true,
		},
		roundedCorners: true,
	});

	mainWindowState.manage(mainWindow);

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
