import type { ChatMessage } from "$lib/stores/chat-state.svelte";
import type { ElectronAPI } from "@electron-toolkit/preload";
import type {
	BroadcastEventData,
	ShellWindowFullscreenChange,
	Tab,
	Theme,
	ThreadParmas,
} from "@shared/types";
import type { ElectronAPIExtension } from "../electron/main/generated/preload-services";

declare global {
	namespace App {}

	interface Window {
		electron: ElectronAPI;
		electronAPI: ElectronAPIExtension;
		electronIPC: {
			onThemeChange: (callback: (theme: Theme) => void) => void;
			onBroadcastEvent: (callback: (eventData: BroadcastEventData) => void) => void;
			onThreadListUpdate: (callback: (eventData: BroadcastEventData) => void) => void;
			onShellWindowFullscreenChange: (
				callback: (payload: ShellWindowFullscreenChange) => void,
			) => () => void;
		};
		windowId: string;
		tab: Tab;
		tabs: Tab[];
		thread: ThreadParmas;
		messages: ChatMessage[];
		app: {
			platform: string;
			isDev: boolean;
		};
	}
}

export {};
