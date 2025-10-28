import type { Theme } from "@shared/types";
import {
	app,
	BrowserWindow,
	nativeTheme,
	WebContentsView,
	type IpcMainInvokeEvent,
} from "electron";
import { CONFIG, isMac, UNSUPPORTED_INJECTING_THEME } from "../../constants";
import { themeStorage } from "../storage-service/theme-storage";

export class AppService {
	async initFromStorage() {
		const state = await themeStorage.getThemeState();
		console.log(`state = ${JSON.stringify(state)}, ${typeof state}`);

		if (state === null) {
			console.warn("Unable to load themeState from storage");
			return;
		}

		nativeTheme.themeSource = state.theme;
	}

	async setTheme(_event: IpcMainInvokeEvent, theme: Theme): Promise<void> {
		nativeTheme.themeSource = theme;
		const allWindows = BrowserWindow.getAllWindows();
		allWindows.forEach((window) => {
			window.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#1A1A1A" : "#F9F9F9");
			if (!isMac) {
				try {
					window.setTitleBarOverlay(
						nativeTheme.shouldUseDarkColors
							? CONFIG.TITLE_BAR_OVERLAY.DARK
							: CONFIG.TITLE_BAR_OVERLAY.LIGHT,
					);
				} catch (_error) {
					// Skip windows that don't have titleBarOverlay enabled (e.g., settings window)
					console.debug(`Skipping titleBarOverlay for window "${window.getTitle()}"`);
				}
			}

			const contentViews = window.contentView.children;
			contentViews.forEach((view) => {
				if (view && "webContents" in view) {
					const webContentsView = view as WebContentsView;
					const url = webContentsView.webContents.getURL();
					if (!url.includes("shell")) {
						const backgroundColor = nativeTheme.shouldUseDarkColors ? "#1A1A1A" : "#F9F9F9";
						webContentsView.setBackgroundColor(backgroundColor);
					}
					if (!webContentsView.webContents.isDestroyed()) {
						const isExternalPage =
							url &&
							!url.startsWith("app://") &&
							!url.includes("localhost") &&
							!url.includes("127.0.0.1") &&
							!UNSUPPORTED_INJECTING_THEME.some((domain) =>
								new URL(url).hostname.endsWith(`${domain}`),
							);
						if (isExternalPage) {
							this.updateWebContentsTheme(webContentsView.webContents);
						}
					}
				}
			});
		});
	}

	private updateWebContentsTheme(webContents: Electron.WebContents) {
		if (webContents.isDestroyed()) return;

		const isDark = nativeTheme.shouldUseDarkColors;
		const colorScheme = isDark ? "dark" : "light";
		const oppositeScheme = isDark ? "light" : "dark";

		const themeCSS = `
			:root {
				color-scheme: ${colorScheme} !important;
			}
			html {
				color-scheme: ${colorScheme} !important;
			}
			body {
				color-scheme: ${colorScheme} !important;
			}
		`;

		webContents.insertCSS(themeCSS).catch((err) => {
			console.warn("Failed to inject theme CSS:", err);
		});

		webContents
			.executeJavaScript(
				`
			(function() {
				const colorScheme = '${colorScheme}';
				const oppositeScheme = '${oppositeScheme}';
				const isDark = ${isDark};

				function applyTheme() {
					// Set on document element
					document.documentElement.style.colorScheme = colorScheme;

					// Remove opposite theme class and add current theme class
					document.documentElement.classList.remove(oppositeScheme);
					document.documentElement.classList.add(colorScheme);

					// Also handle html and body
					if (document.body) {
						document.body.style.colorScheme = colorScheme;
						document.body.classList.remove(oppositeScheme);
						document.body.classList.add(colorScheme);
					}

					// Update or create meta tag
					let meta = document.querySelector('meta[name="color-scheme"]');
					if (meta) {
						meta.setAttribute('content', colorScheme);
					} else {
						meta = document.createElement('meta');
						meta.name = 'color-scheme';
						meta.content = colorScheme;
						if (document.head) {
							document.head.appendChild(meta);
						}
					}
				}

				// Apply immediately
				applyTheme();

				// Watch for class changes and force our theme
				if (window.__themeObserver) {
					window.__themeObserver.disconnect();
				}

				const observer = new MutationObserver(function(mutations) {
					mutations.forEach(function(mutation) {
						if (mutation.type === 'attributes' &&
							(mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
							const target = mutation.target;
							if (target === document.documentElement || target === document.body) {
								// Reapply if wrong class is added
								if (target.classList.contains(oppositeScheme)) {
									target.classList.remove(oppositeScheme);
									target.classList.add(colorScheme);
								}
								// Ensure color-scheme style is maintained
								if (target.style.colorScheme !== colorScheme) {
									target.style.colorScheme = colorScheme;
								}
							}
						}
					});
				});

				observer.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ['class', 'style']
				});

				if (document.body) {
					observer.observe(document.body, {
						attributes: true,
						attributeFilter: ['class', 'style']
					});
				}

				window.__themeObserver = observer;
			})();
		`,
			)
			.catch((err) => {
				console.warn("Failed to set color-scheme:", err);
			});
	}

	/**
	 * Restart the entire Electron application
	 */
	async restartApp(_event: IpcMainInvokeEvent): Promise<void> {
		console.log("Restarting application...");
		app.relaunch();
		app.exit(0);
	}

	/**
	 * Reset all application data and restart
	 */
	async resetAllData(_event: IpcMainInvokeEvent): Promise<void> {
		console.log("Resetting all data...");
		const { storageService } = await import("../storage-service");
		await storageService.clear(_event);
		console.log("All data cleared, restarting...");
		app.relaunch();
		app.exit(0);
	}
}

export const appService = new AppService();
