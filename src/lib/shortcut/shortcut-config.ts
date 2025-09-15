type CreateShortcutData = {
	id: string;
	order: number;
	keys: Set<string>;
	action:
		| "newChat"
		| "clearMessages"
		| "closeCurrentTab"
		| "closeOtherTabs"
		| "deleteCurrentThread"
		| "openSettings"
		| "toggleSidebar"
		| "stopGeneration"
		| "newTab"
		| "regenerateResponse"
		| "search"
		| "createBranch"
		| "restoreLastTab"
		| "screenshot"
		| "nextTab"
		| "previousTab"
		| "toggleModelPanel"
		| "toggleIncognitoMode"
		| "branchAndSend"
		| "switchToTab1"
		| "switchToTab2"
		| "switchToTab3"
		| "switchToTab4"
		| "switchToTab5"
		| "switchToTab6"
		| "switchToTab7"
		| "switchToTab8"
		| "switchToTab9";
	scope: "global" | "app";
};

export const DEFAULT_SHORTCUTS: CreateShortcutData[] = [
	{
		id: "clearMessages",
		order: 2,
		action: "clearMessages",
		keys: new Set(["Cmd", "L"]),
		scope: "app",
	},

	{
		id: "regenerateResponse",
		order: 4,
		action: "regenerateResponse",
		keys: new Set(["Cmd", "R"]),
		scope: "app",
	},
	{
		id: "createBranch",
		order: 5,
		action: "createBranch",
		keys: new Set(["Cmd", "Shift", "N"]),
		scope: "app",
	},
	{
		id: "branchAndSend",
		order: 6,
		action: "branchAndSend",
		keys: new Set(["Cmd", "Shift", "Enter"]),
		scope: "app",
	},

	{
		id: "search",
		order: 12,
		action: "search",
		keys: new Set(["Cmd", "F"]),
		scope: "app",
	},
	{
		id: "newTab",
		order: 20,
		action: "newTab",
		keys: new Set(["Cmd", "T"]),
		scope: "app",
	},
	{
		id: "closeCurrentTab",
		order: 21,
		action: "closeCurrentTab",
		keys: new Set(["Cmd", "W"]),
		scope: "app",
	},
	{
		id: "closeOtherTabs",
		order: 22,
		action: "closeOtherTabs",
		keys: new Set(["Cmd", "Option", "W"]),
		scope: "app",
	},

	{
		id: "nextTab",
		order: 25,
		action: "nextTab",
		keys: new Set(["Ctrl", "Tab"]),
		scope: "app",
	},
	{
		id: "previousTab",
		order: 26,
		action: "previousTab",
		keys: new Set(["Ctrl", "Shift", "Tab"]),
		scope: "app",
	},
	{
		id: "switchToTab1",
		order: 30,
		action: "switchToTab1",
		keys: new Set(["Cmd", "1"]),
		scope: "app",
	},
	{
		id: "switchToTab2",
		order: 31,
		action: "switchToTab2",
		keys: new Set(["Cmd", "2"]),
		scope: "app",
	},
	{
		id: "switchToTab3",
		order: 32,
		action: "switchToTab3",
		keys: new Set(["Cmd", "3"]),
		scope: "app",
	},
	{
		id: "switchToTab4",
		order: 33,
		action: "switchToTab4",
		keys: new Set(["Cmd", "4"]),
		scope: "app",
	},
	{
		id: "switchToTab5",
		order: 34,
		action: "switchToTab5",
		keys: new Set(["Cmd", "5"]),
		scope: "app",
	},
	{
		id: "switchToTab6",
		order: 35,
		action: "switchToTab6",
		keys: new Set(["Cmd", "6"]),
		scope: "app",
	},
	{
		id: "switchToTab7",
		order: 36,
		action: "switchToTab7",
		keys: new Set(["Cmd", "7"]),
		scope: "app",
	},
	{
		id: "switchToTab8",
		order: 37,
		action: "switchToTab8",
		keys: new Set(["Cmd", "8"]),
		scope: "app",
	},
	{
		id: "switchToTab9",
		order: 38,
		action: "switchToTab9",
		keys: new Set(["Cmd", "9"]),
		scope: "app",
	},
	{
		id: "toggleSidebar",
		order: 40,
		action: "toggleSidebar",
		keys: new Set(["Cmd", "B"]),
		scope: "app",
	},
	{
		id: "toggleModelPanel",
		order: 41,
		action: "toggleModelPanel",
		keys: new Set(["Cmd", "M"]),
		scope: "app",
	},
	{
		id: "toggleIncognitoMode",
		order: 42,
		action: "toggleIncognitoMode",
		keys: new Set(["Cmd", "E"]),
		scope: "app",
	},
	{
		id: "openSettings",
		order: 50,
		action: "openSettings",
		keys: new Set(["Cmd", ","]),
		scope: "app",
	},
	{
		id: "stopGeneration",
		order: 51,
		action: "stopGeneration",
		keys: new Set(["Cmd", "D"]),
		scope: "app",
	},
	{
		id: "deleteCurrentThread",
		order: 52,
		action: "deleteCurrentThread",
		keys: new Set([]),
		scope: "app",
	},
];

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
export type ShortcutAction =
	| "newChat"
	| "clearMessages"
	| "closeCurrentTab"
	| "closeOtherTabs"
	| "deleteCurrentThread"
	| "openSettings"
	| "toggleSidebar"
	| "stopGeneration"
	| "newTab"
	| "regenerateResponse"
	| "search"
	| "createBranch"
	| "restoreLastTab"
	| "screenshot"
	| "nextTab"
	| "previousTab"
	| "toggleModelPanel"
	| "toggleIncognitoMode"
	| "branchAndSend"
	| "switchToTab1"
	| "switchToTab2"
	| "switchToTab3"
	| "switchToTab4"
	| "switchToTab5"
	| "switchToTab6"
	| "switchToTab7"
	| "switchToTab8"
	| "switchToTab9";

export type ShortcutScope = "global" | "app";
export interface ShortcutOption {
	id: string;
	label: string;
	keys: string[];
}

export type ShortcutActionWithoutSendMessage = Exclude<ShortcutAction, "send-message">;

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
