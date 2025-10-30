import { shell, WebContentsView } from "electron";
import { match, P } from "ts-pattern";
import { isLinux, isMac, isWin } from "../constants";

export interface LoadHandlerConfig {
	baseUrl?: string;
	routePath?: string;
	autoOpenDevTools?: boolean;
}

/**
 * Adds cross-platform devTools shortcut handling to a WebContentsView
 */
export const withDevToolsShortcuts = (view: WebContentsView): void => {
	view.webContents.on("before-input-event", (event, input) => {
		const isDevToolsShortcut = match(input)
			.with({ key: "F12" }, () => true)
			.with(
				{
					key: P.union("i", "I"),
					meta: true,
					alt: true,
				},
				() => isMac,
			)
			.with(
				{
					key: P.union("i", "I"),
					control: true,
					shift: true,
				},
				() => isWin || isLinux,
			)
			.otherwise(() => false);

		if (isDevToolsShortcut) {
			event.preventDefault();
			if (view.webContents.isDevToolsOpened()) {
				view.webContents.closeDevTools();
			} else {
				view.webContents.openDevTools({ mode: "detach" });
			}
		}
	});
};

/**
 * Adds common load handling to a WebContentsView
 */
export const withLoadHandlers = (view: WebContentsView, config: LoadHandlerConfig): void => {
	const { baseUrl, routePath, autoOpenDevTools = false } = config;

	if (baseUrl) {
		const fullUrl = routePath ? `${baseUrl}${routePath}` : baseUrl;
		view.webContents.loadURL(fullUrl);

		if (autoOpenDevTools) {
			view.webContents.once("did-frame-finish-load", () => {
				view.webContents.openDevTools({ mode: "detach" });
			});
		}
	}
};

/**
 * Adds lifecycle event handlers to a WebContentsView
 */
export const withLifecycleHandlers = (
	view: WebContentsView,
	callbacks: {
		onDestroyed?: () => void;
		onWillPreventUnload?: () => void;
	},
): void => {
	if (callbacks.onDestroyed) {
		view.webContents.on("destroyed", callbacks.onDestroyed);
	}

	if (callbacks.onWillPreventUnload) {
		view.webContents.on("will-prevent-unload", callbacks.onWillPreventUnload);
	}
};

/**
 * Adds external link handler to open links in default browser
 */
export const withExternalLinkHandler = (view: WebContentsView): void => {
	// Handle links opened via window.open or target="_blank"
	view.webContents.setWindowOpenHandler(({ url }) => {
		// Check if it's an external URL (http/https)
		if (url.startsWith("http://") || url.startsWith("https://")) {
			shell.openExternal(url);
			return { action: "deny" };
		}
		// For internal URLs, allow them to open normally
		return { action: "allow" };
	});

	// Handle navigation attempts (clicking links without target="_blank")
	view.webContents.on("will-navigate", (event, url) => {
		// Get the current URL
		const currentUrl = view.webContents.getURL();

		// Check if it's an external URL (http/https) and different from current domain
		if (url.startsWith("http://") || url.startsWith("https://")) {
			try {
				const currentDomain = new URL(currentUrl).hostname;
				const targetDomain = new URL(url).hostname;

				// If navigating to a different domain or if current is app:// protocol, open externally
				if (currentUrl.startsWith("app://") || currentDomain !== targetDomain) {
					event.preventDefault();
					shell.openExternal(url);
				}
			} catch {
				// If URL parsing fails, just open externally to be safe
				event.preventDefault();
				shell.openExternal(url);
			}
		}
	});
};
