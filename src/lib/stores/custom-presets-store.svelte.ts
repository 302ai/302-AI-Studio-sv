import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { CustomPreset as CustomPresetType } from "@shared/storage/chat-parameters";

const CUSTOM_PRESETS_KEY = "app-chat-custom-presets";

const initialCustomPresets: CustomPresetType[] = [];

const persistedCustomPresetsState = new PersistedState<CustomPresetType[]>(
	CUSTOM_PRESETS_KEY,
	initialCustomPresets,
);

export const EMPTY_PHRASING =
	'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

export const DEFAULT_USER_PHRASING =
	'{"root":{"children":[{"children":[{"type":"variable-value","version":1,"variable":"input"}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

class CustomPresetsStore {
	get presets(): CustomPresetType[] {
		return persistedCustomPresetsState.current;
	}

	addPreset(name: string, systemPhrasing: string, userPhrasing?: string): CustomPresetType {
		const key = `custom-${Date.now()}`;
		const newPreset: CustomPresetType = {
			key,
			name,
			systemPhrasing,
			userPhrasing: userPhrasing ?? EMPTY_PHRASING,
		};
		const current = [...persistedCustomPresetsState.current, newPreset];
		persistedCustomPresetsState.current = current;
		return newPreset;
	}

	updatePreset(key: string, systemPhrasing: string, userPhrasing?: string): void {
		const current = persistedCustomPresetsState.current;
		const index = current.findIndex((p) => p.key === key);
		if (index === -1) return;
		const updates: Partial<CustomPresetType> = { systemPhrasing };
		if (userPhrasing !== undefined) {
			updates.userPhrasing = userPhrasing;
		}
		current[index] = { ...current[index], ...updates };
		persistedCustomPresetsState.current = [...current];
	}

	deletePreset(key: string): void {
		const current = persistedCustomPresetsState.current;
		persistedCustomPresetsState.current = current.filter((p) => p.key !== key);
	}

	getPreset(key: string): CustomPresetType | undefined {
		return persistedCustomPresetsState.current.find((p) => p.key === key);
	}

	savePreset(key: string, name: string, systemPhrasing: string, userPhrasing?: string): void {
		const current = persistedCustomPresetsState.current;
		const index = current.findIndex((p) => p.key === key);
		if (index === -1) {
			persistedCustomPresetsState.current = [
				...current,
				{ key, name, systemPhrasing, userPhrasing: userPhrasing ?? EMPTY_PHRASING },
			];
		} else {
			const updates: Partial<CustomPresetType> = { systemPhrasing, name };
			if (userPhrasing !== undefined) {
				updates.userPhrasing = userPhrasing;
			}
			current[index] = { ...current[index], ...updates };
			persistedCustomPresetsState.current = [...current];
		}
	}
}

export const customPresetsStore = new CustomPresetsStore();
