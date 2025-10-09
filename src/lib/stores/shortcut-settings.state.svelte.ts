import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import {
	DEFAULT_SHORTCUTS,
	type ShortcutAction,
	type ShortcutScope,
} from "$lib/shortcut/shortcut-config";

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
