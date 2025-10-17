import type {
	InputEventLike,
	ShortcutBinding,
	ShortcutConflict,
	ShortcutContext,
	ShortcutKeyPressEvent,
	ShortcutScope,
} from "@shared/types/shortcut";
import { keysToAccelerator, keysToString, normalizeKeys } from "@shared/utils/shortcut-utils";
import { globalShortcut, WebContentsView } from "electron";

type ShortcutHandler = (action: string, ctx: ShortcutContext) => void | Promise<void>;

interface ShortcutMatch {
	binding: ShortcutBinding;
	scope: ShortcutScope;
}

export class ShortcutEngine {
	private shortcuts: ShortcutBinding[] = [];
	private handler: ShortcutHandler | null = null;
	private conflicts: ShortcutConflict[] = [];
	private lastSync: number = 0;

	private globalIndex = new Map<string, ShortcutBinding>();
	private appIndex = new Map<string, ShortcutBinding>();
	private windowIndex = new Map<number, Map<string, ShortcutBinding>>();
	private webviewIndex = new Map<string, Map<string, ShortcutBinding>>();

	// Deduplication: track last handled shortcut to prevent duplicate triggers
	private lastHandledKey: string | null = null;
	private lastHandledTime: number = 0;
	private readonly DEBOUNCE_MS = 200; // 200ms debounce window

	constructor() {}

	init(shortcuts: ShortcutBinding[], handler: ShortcutHandler): void {
		this.handler = handler;
		this.updateShortcuts(shortcuts);
	}

	updateShortcuts(shortcuts: ShortcutBinding[]): void {
		this.shortcuts = shortcuts;
		this.lastSync = Date.now();

		this.rebuildIndexes();
		this.detectConflicts();
		this.registerGlobalShortcuts();
	}

	attachToView(view: WebContentsView, windowId: number, viewId: string): void {
		view.webContents.on("before-input-event", (electronEvent, input) => {
			this.handleBeforeInput(electronEvent, input, windowId, viewId);
		});
	}

	getConflicts(): ShortcutConflict[] {
		return this.conflicts;
	}

	getSyncInfo() {
		return {
			shortcuts: this.shortcuts,
			appliedAt: this.lastSync,
			conflicts: this.conflicts,
		};
	}

	handleKeyPressed(keyEvent: ShortcutKeyPressEvent): void {
		const key = keysToString(keyEvent.keys);
		const windowId = keyEvent.windowId;
		const viewId = keyEvent.viewId || "";

		// Check if this is editable and the shortcut requires non-editable
		const match = this.findMatch(key, windowId, viewId);
		if (!match) return;

		if (match.binding.requiresNonEditable && keyEvent.editable) {
			return;
		}

		// Dispatch the action
		this.dispatch(match.binding.action, { windowId, viewId });
	}

	private rebuildIndexes(): void {
		this.globalIndex.clear();
		this.appIndex.clear();
		this.windowIndex.clear();
		this.webviewIndex.clear();

		for (const shortcut of this.shortcuts) {
			const key = keysToString(shortcut.keys);

			switch (shortcut.scope) {
				case "global":
					this.globalIndex.set(key, shortcut);
					break;
				case "app":
					this.appIndex.set(key, shortcut);
					break;
				case "window":
				case "webview":
					break;
			}
		}
	}

	detectConflicts(): void {
		const conflicts: ShortcutConflict[] = [];
		const keyMap = new Map<string, { scope: ShortcutScope; bindings: ShortcutBinding[] }>();

		for (const shortcut of this.shortcuts) {
			const key = keysToString(shortcut.keys);
			const existing = keyMap.get(key);

			if (existing && existing.scope === shortcut.scope) {
				existing.bindings.push(shortcut);
			} else if (!existing) {
				keyMap.set(key, { scope: shortcut.scope, bindings: [shortcut] });
			}
		}

		for (const [key, { scope, bindings }] of keyMap) {
			if (bindings.length > 1) {
				conflicts.push({
					key,
					bindings,
					scope,
					reason: "same-scope",
				});
			}
		}

		this.conflicts = conflicts;
	}

	private registerGlobalShortcuts(): void {
		globalShortcut.unregisterAll();

		for (const [key, binding] of this.globalIndex) {
			try {
				const accelerator = keysToAccelerator(binding.keys);
				const success = globalShortcut.register(accelerator, () => {
					this.dispatch(binding.action, { windowId: -1 });
				});

				if (!success) {
					console.warn(`Failed to register global shortcut: ${key}`);
					this.conflicts.push({
						key,
						bindings: [binding],
						scope: "global",
						reason: "global-failed",
					});
				}
			} catch (error) {
				console.error(`Error registering global shortcut ${key}:`, error);
			}
		}
	}

	private handleBeforeInput(
		electronEvent: Electron.Event,
		input: Electron.Input,
		windowId: number,
		viewId: string,
	): void {
		const keys = normalizeKeys(input as InputEventLike);
		const key = keysToString(keys);

		// Ignore empty keys or modifier-only keys (key releases)
		if (!key || keys.length === 0) {
			return;
		}

		const match = this.findMatch(key, windowId, viewId);

		if (match) {
			// Debounce: prevent duplicate triggers within the debounce window
			const now = Date.now();
			const keyIdentifier = `${windowId}:${key}`;
			const timeSinceLastHandle = now - this.lastHandledTime;

			if (this.lastHandledKey === keyIdentifier && timeSinceLastHandle < this.DEBOUNCE_MS) {
				// This is a duplicate event within the debounce window, ignore it
				electronEvent.preventDefault();
				return;
			}

			// Update debounce tracking
			this.lastHandledKey = keyIdentifier;
			this.lastHandledTime = now;

			electronEvent.preventDefault();
			this.dispatch(match.binding.action, { windowId, viewId });
		}
	}

	private findMatch(key: string, windowId: number, viewId: string): ShortcutMatch | null {
		const webviewMap = this.webviewIndex.get(viewId);
		if (webviewMap?.has(key)) {
			return { binding: webviewMap.get(key)!, scope: "webview" };
		}

		const windowMap = this.windowIndex.get(windowId);
		if (windowMap?.has(key)) {
			return { binding: windowMap.get(key)!, scope: "window" };
		}

		if (this.appIndex.has(key)) {
			return { binding: this.appIndex.get(key)!, scope: "app" };
		}

		return null;
	}

	private dispatch(action: string, ctx: ShortcutContext): void {
		if (this.handler) {
			this.handler(action, ctx);
		}
	}
}
