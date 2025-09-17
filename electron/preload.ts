import { contextBridge, ipcRenderer } from "electron";
import type { Theme } from "./shared/types";

contextBridge.exposeInMainWorld("electronAPI", {
	theme: {
		setTheme: (theme: Theme) => ipcRenderer.send("app:theme:setTheme", theme),
		onThemeChange: (callback: (theme: Theme) => void) => {
			ipcRenderer.on("app:theme:setTheme", (_, theme) => callback(theme));
		},
		getCurrentTheme: () => ipcRenderer.invoke("app:theme:getCurrentTheme"),
	},
});
