import type { ShortcutAction } from "@shared/config/default-shortcuts";

export type { ShortcutAction };

export type ShortcutActionWithoutSendMessage = Exclude<ShortcutAction, "send-message">;

export type ShortcutScope = "global" | "app";
export interface ShortcutOption {
	id: string;
	label: string;
	keys: string[];
}

export const SHORTCUT_MODES: Record<
	ShortcutActionWithoutSendMessage,
	"preset" | "record" | "display"
> = {
	newChat: "record",
	clearMessages: "record",
	closeCurrentTab: "display",
	closeOtherTabs: "display",
	deleteCurrentThread: "record",
	openSettings: "display",
	toggleSidebar: "display",
	stopGeneration: "record",
	newTab: "display",
	regenerateResponse: "record",
	search: "display",
	createBranch: "record",
	restoreLastTab: "display",
	screenshot: "record",
	nextTab: "display",
	previousTab: "display",
	toggleModelPanel: "record",
	toggleIncognitoMode: "record",
	branchAndSend: "record",
	switchToTab1: "display",
	switchToTab2: "display",
	switchToTab3: "display",
	switchToTab4: "display",
	switchToTab5: "display",
	switchToTab6: "display",
	switchToTab7: "display",
	switchToTab8: "display",
	switchToTab9: "display",
};

export const SHORTCUT_OPTIONS: Record<ShortcutActionWithoutSendMessage, ShortcutOption[]> = {
	newChat: [],
	clearMessages: [],
	closeCurrentTab: [],
	closeOtherTabs: [],
	deleteCurrentThread: [],
	openSettings: [],
	toggleSidebar: [],

	stopGeneration: [],
	newTab: [],

	regenerateResponse: [],
	search: [],
	createBranch: [],
	restoreLastTab: [],
	screenshot: [],
	nextTab: [],
	previousTab: [],
	toggleModelPanel: [],
	toggleIncognitoMode: [],
	branchAndSend: [],

	switchToTab1: [],
	switchToTab2: [],
	switchToTab3: [],
	switchToTab4: [],
	switchToTab5: [],
	switchToTab6: [],
	switchToTab7: [],
	switchToTab8: [],
	switchToTab9: [],
};
export const isMac = false;
export const isWindows = true;
export const isLinux = false;
export const isDev = process.env.NODE_ENV === "development";

export const PLATFORM_KEY_MAP: Record<string, string> = {
	Cmd: isMac ? "⌘" : "Ctrl",
	Meta: isMac ? "⌘" : "Win",
	Alt: isMac ? "⌥" : "Alt",
	Option: isMac ? "⌥" : "Alt",
	Shift: isMac ? "⇧" : "Shift",
	Control: isMac ? "⌃" : "Ctrl ",
	Enter: "Enter",
	Backspace: isMac ? "⌫" : "Backspace",
	Delete: isMac ? "⌦" : "Delete",
	Tab: isMac ? "⇥" : "Tab",
	Escape: isMac ? "⎋" : "Esc",
	Space: "Space",
	ArrowUp: "↑",
	ArrowDown: "↓",
	ArrowLeft: "←",
	ArrowRight: "→",
};

function sortKeys(keys: string[]): string[] {
	const modifierOrder = ["Ctrl", "Cmd", "Meta", "Alt", "Shift"];
	const modifiers: string[] = [];
	const regularKeys: string[] = [];

	keys.forEach((key) => {
		if (modifierOrder.includes(key)) {
			modifiers.push(key);
		} else {
			regularKeys.push(key);
		}
	});

	modifiers.sort((a, b) => modifierOrder.indexOf(a) - modifierOrder.indexOf(b));

	regularKeys.sort();

	return [...modifiers, ...regularKeys];
}

export function formatShortcutKeys(keys: string[]): string {
	const sortedKeys = sortKeys(keys);
	return sortedKeys.map((key) => PLATFORM_KEY_MAP[key] || key).join("+");
}

export function formatShortcutLabel(keys: string[]): string {
	const sortedKeys = sortKeys(keys);
	const formattedKeys = sortedKeys.map((key) => PLATFORM_KEY_MAP[key] || key);
	return formattedKeys.join("+");
}
