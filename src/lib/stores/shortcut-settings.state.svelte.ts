import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { createLogger } from "@shared/logger";

const logger = createLogger("state");
import { type ShortcutAction, type ShortcutScope } from "$lib/shortcut/shortcut-config";
import { DEFAULT_SHORTCUTS } from "@shared/config/default-shortcuts";

export interface ShortcutBinding {
	id: string;
	action: ShortcutAction;
	keys: string[];
	scope: ShortcutScope;
	order: number;
	version?: number;
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
		version: s.version,
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
		const state = persistedShortcutSettings.current;
		const currentShortcuts = [...state.shortcuts]; // Create a copy to work with
		let needsUpdate = false;

		// Check if we're on Mac
		const isMac = typeof window !== "undefined" && window.app?.platform === "darwin";

		// Only apply platform-specific migration on non-Mac platforms
		if (!isMac) {
			// Check if any shortcut has Cmd or Option
			const hasOldKeys = currentShortcuts.some((s) =>
				s.keys.some((key) => key === "Cmd" || key === "Option"),
			);

			if (hasOldKeys) {
				// Migrate Cmd -> Ctrl and Option -> Alt (Windows/Linux only)
				const migratedShortcuts = currentShortcuts.map((shortcut) => ({
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

				currentShortcuts.splice(0, currentShortcuts.length, ...migratedShortcuts);
			}
		}

		// Sync shortcuts with DEFAULT_SHORTCUTS based on version
		// This applies to all platforms (Mac, Windows, Linux)
		const updatedShortcuts: ShortcutBinding[] = [];
		const updates: string[] = [];

		for (const defaultShortcut of DEFAULT_SHORTCUTS) {
			const userShortcut = currentShortcuts.find((s) => s.action === defaultShortcut.action);
			const userVersion = userShortcut?.version || 0;

			if (userVersion < defaultShortcut.version) {
				// Need to update this shortcut
				let newKeys: string[];

				// Special case: toggleModelPanel version 2 changes default keys from Cmd+M to Ctrl+M
				if (defaultShortcut.action === "toggleModelPanel" && userVersion < 2) {
					// Only update keys if user hasn't customized this shortcut
					// Check if user's keys are the same as old default (Cmd+M)
					const oldDefaultKeys = ["Cmd", "M"];
					const isUsingOldDefault =
						userShortcut &&
						userShortcut.keys.length === oldDefaultKeys.length &&
						oldDefaultKeys.every((key) => userShortcut.keys.includes(key));

					if (isUsingOldDefault || !userShortcut) {
						// User is using old default or doesn't have this shortcut, update to new default
						newKeys = Array.from(defaultShortcut.keys);
					} else {
						// User has customized the keys, keep their setting
						newKeys = userShortcut.keys;
					}
				} else {
					// For all other updates (new shortcuts, order changes, etc.) keep user's keys
					newKeys = userShortcut?.keys || Array.from(defaultShortcut.keys);
				}

				updatedShortcuts.push({
					id: defaultShortcut.id,
					action: defaultShortcut.action,
					keys: newKeys,
					scope: defaultShortcut.scope,
					order: defaultShortcut.order,
					version: defaultShortcut.version,
				});
				updates.push(defaultShortcut.action);
				needsUpdate = true;
			} else {
				// No update needed, keep user's shortcut as is
				updatedShortcuts.push(userShortcut!);
			}
		}

		if (updates.length > 0) {
			logger.info(`[Shortcut Migration] Updated ${updates.length} shortcuts:`, updates.join(", "));
		}

		// Sort shortcuts by order
		updatedShortcuts.sort((a, b) => a.order - b.order);

		if (needsUpdate) {
			this._updateShortcuts(updatedShortcuts);
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

	private _updateShortcuts(newShortcuts: ShortcutBinding[]): void {
		persistedShortcutSettings.current = {
			...persistedShortcutSettings.current,
			shortcuts: newShortcuts,
		};
	}

	updateShortcut(action: ShortcutAction, keys: string[]): void {
		const shortcuts = persistedShortcutSettings.current.shortcuts.map((s) =>
			s.action === action ? { ...s, keys } : s,
		);
		this._updateShortcuts(shortcuts);
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
				logger.error("Failed to sync shortcuts:", err);
			});
		});
	});
}
