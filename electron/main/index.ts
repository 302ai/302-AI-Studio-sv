/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />

import { DEFAULT_SHORTCUTS } from "@shared/config/default-shortcuts";
import type { ShortcutBinding, ShortcutScope } from "@shared/types/shortcut";
import { app, net, protocol } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import { isMac } from "./constants";
import { registerIpcHandlers } from "./generated/ipc-registration";
import { initServer } from "./server/router";
import { appService, shortcutService, windowService } from "./services";

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

	// Initialize shortcut system
	const defaultShortcuts: ShortcutBinding[] = DEFAULT_SHORTCUTS.map((s) => ({
		id: s.id,
		action: s.action,
		keys: Array.from(s.keys),
		scope: s.scope as ShortcutScope,
		order: s.order,
		requiresNonEditable: true,
	}));
	shortcutService.getEngine().init(defaultShortcuts, async (action, ctx) => {
		const { shortcutActionsHandler } = await import("./services/shortcut-service/actions-handler");
		await shortcutActionsHandler.handle(action, ctx);
	});

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
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
	init();
	initServer();
	windowService.initShellWindows();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (!isMac) app.quit();
});

// macOS specific handling for Cmd+Q to ensure proper cleanup
if (isMac) {
	// Handle Cmd+Q (or menu quit) - ensure window close listeners fire
	app.on("before-quit", (event) => {
		event.preventDefault();
		// Enable force quitting mode to bypass macOS hide behavior
		windowService.setCMDQ(true);

		// Close windows in reverse order so main window closes last
		const windows = windowService.getOrderedWindows().reverse();
		windows.forEach((window) => {
			window.close();
		});

		app.exit();
	});
}

app.on("activate", () => {
	const mainWindow = windowService.getMainWindow();
	if (mainWindow) mainWindow.show();
	else windowService.initShellWindows();
});
