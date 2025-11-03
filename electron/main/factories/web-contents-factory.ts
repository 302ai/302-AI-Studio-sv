import type { Tab } from "@shared/types";
import { nativeTheme, WebContentsView } from "electron";
import path from "node:path";
import { UNSUPPORTED_INJECTING_THEME } from "../constants";
import { withExternalLinkHandler } from "../mixins/web-contents-mixins";
import { TempStorage } from "../utils/temp-storage";

export interface WebContentsConfig {
	windowId: number;
	type: "shell" | "tab" | "aiApplication";
	additionalArgs?: string[];
	onDestroyed?: () => void;
}

export interface TabWebContentsConfig extends WebContentsConfig {
	type: "tab";
	tab: Tab;
	threadFilePath: string;
	messagesFilePath: string;
}

export interface ShellWebContentsConfig extends WebContentsConfig {
	type: "shell";
}

export interface AiApplicationWebContentsConfig extends WebContentsConfig {
	type: "aiApplication";
}

export class WebContentsFactory {
	private static serverPort: number | null = null;

	static setServerPort(port: number) {
		this.serverPort = port;
	}

	static create(config: WebContentsConfig): WebContentsView {
		const commonArgs = [
			`--window-id=${config.windowId}`,
			...(this.serverPort !== null ? [`--server-port=${this.serverPort}`] : []),
		];
		const additionalArgs = config.additionalArgs || [];

		const view = new WebContentsView({
			webPreferences: {
				preload: path.join(import.meta.dirname, "../preload/index.cjs"),
				devTools: true,
				webgl: true,
				additionalArguments: [...commonArgs, ...additionalArgs],
				sandbox: false,
				webSecurity: false,
			},
		});

		const backgroundColor = nativeTheme.shouldUseDarkColors ? "#121212" : "#F9F9F9";
		view.setBackgroundColor(backgroundColor);

		// Add external link handler to all views
		withExternalLinkHandler(view);

		if (config.type === "aiApplication") {
			view.webContents.on("dom-ready", () => {
				this.applyThemeToWebContents(view.webContents);
			});

			view.webContents.on("did-finish-load", () => {
				this.applyThemeToWebContents(view.webContents);
			});

			view.webContents.on("did-navigate", () => {
				this.applyThemeToWebContents(view.webContents);
			});

			view.webContents.on("did-navigate-in-page", () => {
				this.applyThemeToWebContents(view.webContents);
			});
		}

		// Add destroyed listener if callback provided
		if (config.onDestroyed) {
			view.webContents.on("destroyed", config.onDestroyed);
		}

		return view;
	}

	private static applyThemeToWebContents(webContents: Electron.WebContents) {
		const url = webContents.getURL();
		const isUnsupported = UNSUPPORTED_INJECTING_THEME.some((domain) =>
			new URL(url).hostname.endsWith(`${domain}`),
		);
		console.log(`Applying theme to ${url}`, isUnsupported);
		if (isUnsupported) return;
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
				if (!window.__themeObserver) {
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
				}
			})();
		`,
			)
			.catch((err) => {
				console.warn("Failed to set color-scheme:", err);
			});
	}

	static createTabView(config: TabWebContentsConfig): WebContentsView {
		// Use temp file for tab data to avoid command li	ne argument length limits
		const tabFilePath = TempStorage.writeData(config.tab, "tab");

		const additionalArgs = [
			`--tab-file=${tabFilePath}`,
			`--thread-file=${config.threadFilePath}`,
			`--messages-file=${config.messagesFilePath}`,
		];

		return this.create({
			...config,
			additionalArgs,
		});
	}

	static createAiApplicationView(config: AiApplicationWebContentsConfig): WebContentsView {
		return this.create(config);
	}

	static createShellView(config: ShellWebContentsConfig): WebContentsView {
		return this.create(config);
	}
}
