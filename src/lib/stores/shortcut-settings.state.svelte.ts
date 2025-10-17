import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { type ShortcutAction, type ShortcutScope } from "$lib/shortcut/shortcut-config";
import { DEFAULT_SHORTCUTS } from "@shared/config/default-shortcuts";

export interface ShortcutBinding {
	id: string;
	action: ShortcutAction;
	keys: string[];
	scope: ShortcutScope;
	order: number;
}

export interface ShortcutSettingsState {
	shortcuts: ShortcutBinding[];
}

const getDefaults = (): ShortcutSettingsState => ({
	shortcuts: DEFAULT_SHORTCUTS.map((s) => ({
		id: s.id,
		action: s.action,
		keys: Array.from(s.keys),
		scope: s.scope,
		order: s.order,
	})),
});

const persistedShortcutSettings = new PersistedState<ShortcutSettingsState>(
	"ShortcutSettingsStorage:state",
	getDefaults(),
);

class ShortcutSettingsManager {
	private migrationApplied = false;

	constructor() {
		// Apply migration once after hydration
		if (typeof window !== "undefined") {
			const checkHydration = () => {
				if (persistedShortcutSettings.isHydrated && !this.migrationApplied) {
					this.applyMigration();
					this.migrationApplied = true;
				} else if (!persistedShortcutSettings.isHydrated) {
					setTimeout(checkHydration, 50);
				}
			};
			checkHydration();
		}
	}

	private applyMigration(): void {
		// Check if we're on Mac - if so, no migration needed
		const isMac = typeof window !== "undefined" && window.app?.platform === "darwin";
		if (isMac) return;

		const state = persistedShortcutSettings.current;
		let needsUpdate = false;

		// Check if any shortcut has Cmd or Option
		const hasOldKeys = state.shortcuts.some((s) =>
			s.keys.some((key) => key === "Cmd" || key === "Option"),
		);

		if (!hasOldKeys) return;

		// Migrate Cmd -> Ctrl and Option -> Alt
		const migratedShortcuts = state.shortcuts.map((shortcut) => ({
			...shortcut,
			keys: shortcut.keys.map((key) => {
				if (key === "Cmd") {
					needsUpdate = true;
					return "Ctrl";
				}
				if (key === "Option") {
					needsUpdate = true;
					return "Alt";
				}
				return key;
			}),
		}));

		if (needsUpdate) {
			console.log("[Shortcut Migration] Migrating shortcuts from Cmd to Ctrl");
			persistedShortcutSettings.current = { shortcuts: migratedShortcuts };
		}
	}

	get state(): ShortcutSettingsState {
		return persistedShortcutSettings.current;
	}

	get shortcuts(): ShortcutBinding[] {
		return persistedShortcutSettings.current.shortcuts;
	}

	getShortcut(action: ShortcutAction): ShortcutBinding | undefined {
		return persistedShortcutSettings.current.shortcuts.find((s) => s.action === action);
	}

	updateShortcut(action: ShortcutAction, keys: string[]): void {
		const shortcuts = persistedShortcutSettings.current.shortcuts.map((s) =>
			s.action === action ? { ...s, keys } : s,
		);
		persistedShortcutSettings.current = { ...persistedShortcutSettings.current, shortcuts };
	}

	resetShortcut(action: ShortcutAction): void {
		const defaultShortcut = DEFAULT_SHORTCUTS.find((s) => s.action === action);
		if (!defaultShortcut) return;

		const shortcuts = persistedShortcutSettings.current.shortcuts.map((s) =>
			s.action === action ? { ...s, keys: Array.from(defaultShortcut.keys) } : s,
		);
		persistedShortcutSettings.current = { ...persistedShortcutSettings.current, shortcuts };
	}

	resetAllShortcuts(): void {
		persistedShortcutSettings.current = getDefaults();
	}
}

export const shortcutSettings = new ShortcutSettingsManager();

// Sync shortcuts to main process when they change
if (typeof window !== "undefined" && window.electronAPI) {
	$effect.root(() => {
		$effect(() => {
			const state = persistedShortcutSettings.current;
			const serializableShortcuts = state.shortcuts.map((s) => ({
				id: s.id,
				action: s.action,
				keys: [...s.keys],
				scope: s.scope,
				order: s.order,
			}));
			window.electronAPI.shortcutService.updateShortcuts(serializableShortcuts).catch((err) => {
				console.error("Failed to sync shortcuts:", err);
			});
		});
	});
}
