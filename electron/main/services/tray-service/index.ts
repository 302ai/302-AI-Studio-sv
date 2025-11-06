import type { LanguageCode } from "@shared/storage/general-settings";
import { app, Menu, nativeImage, Tray } from "electron";
import path from "node:path";
import { isMac } from "../../constants";
import { emitter } from "../broadcast-service";
import { generalSettingsStorage } from "../storage-service/general-settings-storage";
import { windowService } from "../window-service";

export class TrayService {
	private tray: Tray | null = null;
	private currentLanguage: LanguageCode = "zh";

	constructor() {
		// Listen for window changes to update tray menu
		app.on("browser-window-created", (_event, window) => {
			// Update menu when window is created
			setTimeout(() => this.updateTrayMenu(), 100);

			// Listen to window events to update menu
			// Use arrow functions to avoid 'this' binding issues
			const updateMenu = () => {
				// Small delay to ensure state is updated
				setTimeout(() => this.updateTrayMenu(), 50);
			};

			window.on("show", updateMenu);
			window.on("hide", updateMenu);
			window.on("minimize", updateMenu);
			window.on("restore", updateMenu);

			// Don't update on close/closed as window might be destroyed
			// The closed event in windowService will trigger a new list
			window.on("closed", () => {
				// Wait a bit longer for window to be removed from the list
				setTimeout(() => this.updateTrayMenu(), 150);
			});
		});

		app.on("browser-window-focus", () => {
			setTimeout(() => this.updateTrayMenu(), 50);
		});

		// Listen for language changes
		emitter.on("general-settings:language-changed", ({ language }) => {
			this.currentLanguage = language;
			this.updateTrayMenu();
		});
	}

	/**
	 * Initialize the system tray with icon and menu
	 */
	async init(): Promise<void> {
		if (this.tray) {
			console.log("[TrayService] Tray already initialized");
			return;
		}

		try {
			// Load current language
			this.currentLanguage = await generalSettingsStorage.getLanguage();

			// Create tray icon
			const iconPath = this.getTrayIconPath();
			const trayIcon = nativeImage.createFromPath(iconPath);

			// Resize icon for better display on different platforms
			if (isMac) {
				// macOS prefers smaller icons (around 22x22)
				this.tray = new Tray(trayIcon.resize({ width: 22, height: 22 }));
			} else {
				// Windows and Linux can handle larger icons
				this.tray = new Tray(trayIcon);
			}

			this.tray.setToolTip("302 AI Studio");

			// Set up context menu
			this.updateTrayMenu();

			// Double-click to show/focus main window
			this.tray.on("double-click", () => {
				this.showMainWindow();
			});

			console.log("[TrayService] Tray initialized successfully");
		} catch (error) {
			console.error("[TrayService] Failed to initialize tray:", error);
		}
	}

	/**
	 * Get the appropriate tray icon path based on platform
	 */
	private getTrayIconPath(): string {
		// In development, use the static folder
		// In production, use the packaged icon
		if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
			// Development mode
			return path.join(import.meta.dirname, "../../../static/icon.png");
		} else {
			// Production mode - icon is in the renderer folder
			return path.join(import.meta.dirname, "../../renderer/main_window/icon.png");
		}
	}

	/**
	 * Get localized text based on current language
	 */
	private t(zh: string, en: string): string {
		return this.currentLanguage === "zh" ? zh : en;
	}

	/**
	 * Update the tray context menu with current windows
	 */
	private updateTrayMenu(): void {
		if (!this.tray) return;

		const windows = windowService.getOrderedWindows();
		const mainWindow = windowService.getMainWindow();

		// Filter out destroyed windows and create menu items
		const windowMenuItems = windows
			.filter((win) => !win.isDestroyed())
			.map((win, index) => {
				const isMain = mainWindow?.id === win.id;
				const isVisible = !win.isDestroyed() && win.isVisible();
				const label = isMain
					? this.t("主窗口", "Main Window")
					: this.t(`窗口 ${index + 1}`, `Window ${index + 1}`);

				return {
					label: `${label} ${isVisible ? "✓" : ""}`,
					click: () => {
						// Check if window is still valid before operating on it
						if (win.isDestroyed()) return;

						if (isVisible) {
							win.hide();
						} else {
							win.show();
							win.focus();
						}
						// Update menu after state change
						setTimeout(() => this.updateTrayMenu(), 100);
					},
				};
			});

		const menuTemplate: Electron.MenuItemConstructorOptions[] = [
			{
				label: this.t("显示所有窗口", "Show All Windows"),
				click: () => {
					windows.forEach((win) => {
						if (win.isDestroyed()) return;
						if (!win.isVisible()) {
							win.show();
						}
						win.focus();
					});
					this.updateTrayMenu();
				},
			},
			{
				label: this.t("隐藏所有窗口", "Hide All Windows"),
				click: () => {
					windows.forEach((win) => {
						if (win.isDestroyed()) return;
						if (win.isVisible()) {
							win.hide();
						}
					});
					this.updateTrayMenu();
				},
			},
			{ type: "separator" },
			...windowMenuItems,
			{ type: "separator" },
			{
				label: this.t("退出", "Quit"),
				click: () => {
					// Force quit the app
					app.quit();
				},
			},
		];

		const contextMenu = Menu.buildFromTemplate(menuTemplate);
		this.tray.setContextMenu(contextMenu);
	}

	/**
	 * Show and focus the main window
	 */
	private showMainWindow(): void {
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
	}

	/**
	 * Destroy the tray icon
	 */
	destroy(): void {
		if (this.tray) {
			this.tray.destroy();
			this.tray = null;
			console.log("[TrayService] Tray destroyed");
		}
	}
}

export const trayService = new TrayService();
