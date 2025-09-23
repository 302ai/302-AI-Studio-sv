/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { app, BrowserWindow, net, protocol } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import { registerIpcHandlers } from "./generated/ipc-registration";
import { appService, windowService } from "./services";

protocol.registerSchemesAsPrivileged([
	{ scheme: "app", privileges: { standard: true, secure: true } },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
	app.quit();
}

async function init() {
	// Register auto-generated IPC handlers
	registerIpcHandlers();

	await appService.initFromStorage();

	protocol.handle("app", (request) => {
		const url = new URL(request.url);
		const filePath = url.pathname.substring(1); // 移除开头的 /

		if (!filePath || filePath === "localhost") {
			return net.fetch(
				`file://${path.join(import.meta.dirname, `../../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)}`,
			);
		}

		return net.fetch(
			`file://${path.join(import.meta.dirname, `../../renderer/${MAIN_WINDOW_VITE_NAME}`, filePath)}`,
		);
	});

	await windowService.initShellWindows();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
	init();
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
		windowService.createSheetWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
