export const isMac = process.platform === "darwin";
export const isWin = process.platform === "win32";
export const isLinux = process.platform === "linux";
export const isDev = process.env.NODE_ENV === "development";

export const ENVIRONMENT = {
	IS_DEV: process.env.NODE_ENV === "development",
};

export const PLATFORM = {
	IS_MAC: process.platform === "darwin",
	IS_WINDOWS: process.platform === "win32",
	IS_LINUX: process.platform === "linux",
};

export const WINDOW_SIZE = {
	MIN_HEIGHT: 800,
	MIN_WIDTH: 1120,
};

export const TITLE_BAR_HEIGHT = 40;

export const CONFIG = {
	TITLE_BAR_OVERLAY: {
		DARK: {
			height: TITLE_BAR_HEIGHT,
			color: isWin ? "rgba(0,0,0,0)" : "rgba(255,255,255,0)",
			symbolColor: "#fff",
		},
		LIGHT: {
			height: TITLE_BAR_HEIGHT,
			color: "rgba(255,255,255,0)",
			symbolColor: "#000",
		},
	},
};

export const SHELL_WINDOW_FULLSCREEN_CHANGED = "shell-window:fullscreen-changed";

export const UNSUPPORTED_INJECTING_THEME: string[] = [
	"-arena.302.ai",
	"-ecom.302.ai",
	"-ppt.302.ai",
	"-vt.302.ai",
	"-writing.302.ai",
	"-translate.302.ai",
	"-ecom1.302.ai",
	"-front.302.ai",
	"-restoration.302.ai",
	"-academic.302.ai",
	"-excel.302.ai",
	"-paint.302.ai",
	"-search.302.ai",
	"-patent.302.ai",
	"-paper.302.ai",
	"-tts.302.ai",
];
