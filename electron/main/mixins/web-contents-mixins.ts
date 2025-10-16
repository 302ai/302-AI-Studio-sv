import { WebContentsView } from "electron";
import { match, P } from "ts-pattern";
import { isLinux, isMac, isWin } from "../constants";

export interface LoadHandlerConfig {
	baseUrl?: string;
	routePath?: string;
	autoOpenDevTools?: boolean;
	autoCleanTempFile?: {
		enable: boolean;
		callback: () => void;
	};
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
	const {
		baseUrl,
		routePath,
		autoOpenDevTools = false,
		autoCleanTempFile = {
			enable: false,
			callback: () => {},
		},
	} = config;

	if (baseUrl) {
		const fullUrl = routePath ? `${baseUrl}${routePath}` : baseUrl;
		view.webContents.loadURL(fullUrl);

		if (autoOpenDevTools) {
			view.webContents.once("did-frame-finish-load", () => {
				view.webContents.openDevTools({ mode: "detach" });
			});
		}
	}

	if (autoCleanTempFile.enable) {
		view.webContents.once("did-frame-finish-load", () => {
			autoCleanTempFile.callback();
		});
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
