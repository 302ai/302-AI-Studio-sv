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
				onShortcutSync: (callback: (data: ShortcutSyncEvent) => void) => () => void;
				onShortcutAction: (callback: (event: ShortcutActionEvent) => void) => () => void;
				sendShortcutKeyPressed: (event: ShortcutKeyPressEvent) => () => void;
			};
			onThemeChange: (callback: (theme: Theme) => void) => () => void;
			onScreenshotTriggered: (callback: (data: { threadId: string }) => void) => () => void;
			onThreadListUpdate: (callback: (eventData: BroadcastEventData) => void) => () => void;
			onShellWindowFullscreenChange: (
				callback: (payload: ShellWindowFullscreenChange) => void,
			) => () => void;
			onTabClearMessages: (
				callback: (data: { tabId: string; threadId: string }) => void,
			) => () => void;
			onTabGenerateTitle: (
				callback: (data: { tabId: string; threadId: string }) => void,
			) => () => void;
			onPersistedStateSync: <T>(key: string, callback: (syncValue: T) => void) => () => void;
			updater: {
				onUpdateChecking: (callback: () => void) => () => void;
				onUpdateAvailable: (callback: () => void) => () => void;
				onUpdateNotAvailable: (callback: () => void) => () => void;
				onUpdateDownloaded: (
					callback: (data: { releaseNotes: string; releaseName: string }) => void,
				) => () => void;
				onUpdateError: (callback: (data: { message: string }) => void) => () => void;
			};
			aiApplication: {
				onAiApplicationsLoading: (callback: (loading: boolean) => void) => () => void;
			};
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
