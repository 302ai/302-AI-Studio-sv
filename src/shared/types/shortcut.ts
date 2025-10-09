export type ShortcutScope = "global" | "app" | "window" | "webview";

export interface ShortcutBinding {
	id: string;
	action: string;
	keys: string[];
	scope: ShortcutScope;
	order: number;
	requiresNonEditable?: boolean;
}

export interface ShortcutContext {
	windowId: number;
	viewId?: string;
	tabId?: string;
}

export interface ShortcutConflict {
	key: string;
	bindings: ShortcutBinding[];
	scope: ShortcutScope;
	reason: "same-scope" | "shadowed" | "global-failed";
}

export interface ShortcutKeyPressEvent {
	windowId: number;
	viewId?: string;
	keys: string[];
	editable: boolean;
}

export interface ShortcutSettingsChangedEvent {
	shortcuts: ShortcutBinding[];
	version?: number;
}

export interface ShortcutSyncEvent {
	shortcuts: ShortcutBinding[];
	appliedAt: number;
	conflicts?: ShortcutConflict[];
}

export interface ShortcutActionEvent {
	action: string;
	ctx: ShortcutContext;
}

export interface ShortcutGlobalErrorEvent {
	key: string;
	reason: string;
}

export interface InputEventLike {
	type: string;
	key: string;
	code: string;
	meta: boolean;
	control: boolean;
	alt: boolean;
	shift: boolean;
}

export type ShortcutConfig = ShortcutBinding;

export interface ShortcutSyncInfo {
	shortcuts: ShortcutBinding[];
	appliedAt: number;
	conflicts: ShortcutConflict[];
}
