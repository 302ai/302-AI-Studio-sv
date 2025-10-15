import type { ChatMessage } from "$lib/stores/chat-state.svelte";
import type { ElectronAPI } from "@electron-toolkit/preload";
import type {
	BroadcastEventData,
	ShellWindowFullscreenChange,
	Tab,
	Theme,
	ThreadParmas,
} from "@shared/types";
import type {
	ShortcutActionEvent,
	ShortcutKeyPressEvent,
	ShortcutSyncEvent,
} from "@shared/types/shortcut";
import type { ElectronAPIExtension } from "../electron/main/generated/preload-services";

declare global {
	namespace App {}

	interface Window {
		electron: ElectronAPI;
		electronAPI: ElectronAPIExtension & {
			theme: {
				setTheme: (theme: Theme) => void;
				onThemeChange: (callback: (theme: Theme) => void) => void;
				getCurrentTheme: () => Promise<Theme>;
			};
			shortcut: {
				onShortcutSync: (callback: (data: ShortcutSyncEvent) => void) => void;
				onShortcutAction: (callback: (event: ShortcutActionEvent) => void) => void;
				sendShortcutKeyPressed: (event: ShortcutKeyPressEvent) => void;
			};
		};
		electronIPC: {
			onThemeChange: (callback: (theme: Theme) => void) => void;
			onBroadcastEvent: (callback: (eventData: BroadcastEventData) => void) => void;
			onThreadListUpdate: (callback: (eventData: BroadcastEventData) => void) => void;
			onShellWindowFullscreenChange: (
				callback: (payload: ShellWindowFullscreenChange) => void,
			) => () => void;
			onPersistedStateSync: <T>(key: string, callback: (syncValue: T) => void) => () => void;
			onUpdateChecking: (callback: () => void) => () => void;
			onUpdateAvailable: (callback: () => void) => () => void;
			onUpdateNotAvailable: (callback: () => void) => () => void;
			onUpdateDownloaded: (
				callback: (data: { releaseNotes: string; releaseName: string }) => void,
			) => () => void;
			onUpdateError: (callback: (data: { message: string }) => void) => () => void;
		};
		windowId: string;
		tab: Tab;
		tabs: Tab[];
		thread: ThreadParmas;
		messages: ChatMessage[];
		app: {
			platform: string;
			isDev: boolean;
			serverPort: number;
		};
	}
}

export {};
