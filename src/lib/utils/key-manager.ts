import type { ShortcutBinding, ShortcutKeyPressEvent } from "@shared/types/shortcut";
import { keysToString } from "@shared/utils/shortcut-utils";

/**
 * Check if the target element is editable (input, textarea, contenteditable)
 */
function isEditableTarget(target: EventTarget | null): boolean {
	if (!target || !(target instanceof HTMLElement)) return false;

	const tagName = target.tagName.toLowerCase();
	if (tagName === "input" || tagName === "textarea") return true;

	const contentEditable = target.getAttribute("contenteditable");
	return contentEditable === "true" || contentEditable === "";
}

/**
 * Normalize keys from DOM KeyboardEvent
 */
function normalizeKeysFromDOM(event: KeyboardEvent): string[] {
	const keys: string[] = [];

	// Add modifiers in canonical order
	if (event.ctrlKey) keys.push("Ctrl");
	if (event.metaKey) keys.push("Cmd");
	if (event.altKey) keys.push("Alt");
	if (event.shiftKey) keys.push("Shift");

	// Add regular key
	if (event.key && !["Control", "Meta", "Alt", "Shift"].includes(event.key)) {
		let keyName = event.key;

		// Normalize special keys
		if (keyName === " ") keyName = "Space";
		else if (keyName === "Escape") keyName = "Esc";
		else if (keyName.length === 1) keyName = keyName.toUpperCase();

		keys.push(keyName);
	}

	return keys;
}

/**
 * KeyManager for renderer process
 * Handles DOM-level key events and communicates with main process
 */
export class KeyManager {
	private shortcuts: Map<string, ShortcutBinding> = new Map();
	private windowId: number = -1;
	private viewId: string = "";
	private cleanupSync?: () => void;

	constructor() {
		this.init();
	}

	private init(): void {
		// Get window and view IDs from window object
		if (window.electronAPI) {
			// These should be injected by preload
			this.windowId = (window as unknown as Record<string, number>).__WINDOW_ID__ || -1;
			this.viewId = (window as unknown as Record<string, string>).__VIEW_ID__ || "";
		}

		// Listen to keydown events
		window.addEventListener("keydown", this.handleKeyDown.bind(this), true);

		// Listen to shortcuts sync from main process
		this.cleanupSync = window.electronAPI.shortcut.onShortcutSync?.(
			this.handleShortcutSync.bind(this),
		);
	}

	destroy(): void {
		if (this.cleanupSync) {
			this.cleanupSync();
			this.cleanupSync = undefined;
		}
		window.removeEventListener("keydown", this.handleKeyDown.bind(this), true);
	}

	private handleKeyDown(event: KeyboardEvent): void {
		const keys = normalizeKeysFromDOM(event);
		if (keys.length === 0) return;

		const key = keysToString(keys);
		const binding = this.shortcuts.get(key);
		const isEditable = isEditableTarget(event.target);

		// If binding requires non-editable and we're in editable, skip
		if (binding?.requiresNonEditable && isEditable) {
			return;
		}

		// If it's a webview-scoped shortcut, consume it here
		if (binding?.scope === "webview") {
			event.preventDefault();
			event.stopPropagation();

			// Send to main process for execution
			this.sendKeyPressed(keys, isEditable);
		} else if (binding) {
			// For app/window level, let main process handle via before-input-event
			// Just send notification
			this.sendKeyPressed(keys, isEditable);
		}
	}

	private handleShortcutSync(data: { shortcuts: ShortcutBinding[] }): void {
		// Update local shortcut map
		this.shortcuts.clear();
		for (const shortcut of data.shortcuts) {
			const key = keysToString(shortcut.keys);
			this.shortcuts.set(key, shortcut);
		}
	}

	private sendKeyPressed(keys: string[], editable: boolean): void {
		if (!window.electronAPI.shortcut.sendShortcutKeyPressed) return;

		const event: ShortcutKeyPressEvent = {
			windowId: this.windowId,
			viewId: this.viewId,
			keys,
			editable,
		};

		window.electronAPI.shortcut.sendShortcutKeyPressed(event);
	}
}

// Auto-initialize when script loads
let keyManager: KeyManager | null = null;

if (typeof window !== "undefined" && window.electronAPI) {
	keyManager = new KeyManager();
}

export default keyManager;
