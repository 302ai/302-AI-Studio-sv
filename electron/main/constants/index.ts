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

export const CONFIG = {
	TITLE_BAR_OVERLAY: {
		DARK: {
			height: 40,
			color: isWin ? "rgba(0,0,0,0)" : "rgba(255,255,255,0)",
			symbolColor: "#fff",
		},
		LIGHT: {
			height: 40,
			color: "rgba(255,255,255,0)",
			symbolColor: "#000",
		},
	},
};
