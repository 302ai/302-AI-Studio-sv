import type { ChatMessage, ThreadParmas } from "$lib/stores/chat-state.svelte";
import type { ElectronAPI } from "@electron-toolkit/preload";
import type { Tab, Theme } from "@shared/types";
import type { ElectronAPIExtension } from "../electron/main/generated/preload-services";

declare global {
	namespace App {}

	interface Window {
		electron: ElectronAPI;
		electronAPI: ElectronAPIExtension;
		electronIPC: {
			onThemeChange: (callback: (theme: Theme) => void) => void;
		};
		windowId: string;
		tab: Tab;
		thread: ThreadParmas;
		messages: ChatMessage[];
		app: {
			platform: string;
		};
	}
}

export {};
