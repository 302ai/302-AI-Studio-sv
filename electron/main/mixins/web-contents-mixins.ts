import { shell, WebContentsView } from "electron";
import { match, P } from "ts-pattern";
import { isLinux, isMac, isWin } from "../constants";
import { deepLinkService } from "../services/deep-link-service";

export interface LoadHandlerConfig {
	baseUrl?: string;
	routePath?: string;
	autoOpenDevTools?: boolean;
	showLoadingPage?: boolean;
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
	const { baseUrl, routePath, autoOpenDevTools = false, showLoadingPage = false } = config;

	if (baseUrl) {
		const fullUrl = routePath ? `${baseUrl}${routePath}` : baseUrl;

		if (showLoadingPage) {
			const loadingUrl = `${baseUrl}/loading`;
			view.webContents.loadURL(loadingUrl);

			setTimeout(() => {
				if (!view.webContents.isDestroyed()) {
					view.webContents.loadURL(fullUrl);
				}
			}, 1000);
		} else {
			view.webContents.loadURL(fullUrl);
		}

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
		// Handle deep links (ai302studio:// protocol)
		if (url.startsWith("ai302studio://")) {
			deepLinkService.handleDeepLink(url);
			return { action: "deny" };
		}

		// Allow Firebase authentication popups
		if (
			url.includes("firebaseapp.com/__/auth/handler") ||
			url.includes("accounts.google.com")
		) {
			return { action: "allow" };
		}

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
		// Handle deep links (ai302studio:// protocol)
		if (url.startsWith("ai302studio://")) {
			event.preventDefault();
			deepLinkService.handleDeepLink(url);
			return;
		}

		// Get the current URL
		const currentUrl = view.webContents.getURL();

		// Allow Firebase authentication redirects
		if (url.includes("firebaseapp.com") || url.includes("accounts.google.com")) {
			return; // Allow navigation for auth flows
		}

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
