const platform = window.app.platform;
export const isMac = platform === "darwin";
export const isWindows = platform === "win32";
export const isLinux = platform === "linux";
