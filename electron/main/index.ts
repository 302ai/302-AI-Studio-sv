/// <reference types="@electron-forge/plugin-vite/forge-vite-env" />
import fixPath from "fix-path";
fixPath();

import { DEFAULT_SHORTCUTS } from "@shared/config/default-shortcuts";
import type { ShortcutBinding, ShortcutScope } from "@shared/types/shortcut";
import { app, net, protocol } from "electron";
import started from "electron-squirrel-startup";
import path from "node:path";
import { isMac } from "./constants";
import { WebContentsFactory } from "./factories/web-contents-factory";
import { registerIpcHandlers } from "./generated/ipc-registration";
import { initializePluginSystem } from "./plugin-manager";
import { initServer } from "./server/router";
import { appService, shortcutService, windowService } from "./services";
import { UpdaterService } from "./services/updater-service";

protocol.registerSchemesAsPrivileged([
	{ scheme: "app", privileges: { standard: true, secure: true } },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
	app.quit();
}

// Implement single instance lock to prevent multiple app instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
	// Another instance is already running, quit this instance
	app.quit();
} else {
	// This instance got the lock, listen for second instance attempts
	app.on("second-instance", () => {
		// When a second instance tries to start, focus the main window instead
		const mainWindow = windowService.getMainWindow();
		if (mainWindow) {
			if (mainWindow.isMinimized()) {
				mainWindow.restore();
			}
			if (!mainWindow.isVisible()) {
				mainWindow.show();
			}
			mainWindow.focus();
		}
	});

	// This method will be called when Electron has finished
	// initialization and is ready to create browser windows.
	// Some APIs can only be used after this event occurs.
	app.on("ready", async () => {
		await init();
		const serverPort = await initServer();
		console.log(`Server initialized on port ${serverPort}`);
		WebContentsFactory.setServerPort(serverPort);
		await windowService.initShellWindows();
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
			if (UpdaterService.isInstallingUpdateNow()) return;

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
}

async function init() {
	// Register auto-generated IPC handlers
	registerIpcHandlers();

	await appService.initFromStorage();

	// Initialize plugin system
	try {
		console.log("[Main] Initializing plugin system...");
		await initializePluginSystem();
		console.log("[Main] Plugin system initialized successfully");
	} catch (error) {
		console.error("[Main] Failed to initialize plugin system:", error);
		// Continue app initialization even if plugin system fails
	}

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

	const root = path.join(import.meta.dirname, `../../renderer/${MAIN_WINDOW_VITE_NAME}`);
	protocol.handle("app", (request) => {
		const url = new URL(request.url);
		let pathname = decodeURIComponent(url.pathname);
		const appIndex = pathname.indexOf("/_app/");
		if (appIndex !== -1) {
			pathname = pathname.slice(appIndex);
		}

		const filePath = pathname.startsWith("/") ? pathname.slice(1) : pathname;

		const isAsset = /\.[a-z0-9]+$/i.test(filePath) || filePath.startsWith("_app/");
		const target = isAsset ? path.join(root, filePath) : path.join(root, "index.html");

		const normalized = path.normalize(target);
		if (!normalized.startsWith(path.normalize(root))) {
			return net.fetch(`file://${path.join(root, "index.html")}`);
		}

		return net.fetch(`file://${normalized}`);
	});
}
