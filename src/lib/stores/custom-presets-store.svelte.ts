import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { CustomPreset as CustomPresetType } from "@shared/storage/chat-parameters";

const CUSTOM_PRESETS_KEY = "app-chat-custom-presets";

const initialCustomPresets: CustomPresetType[] = [];

const persistedCustomPresetsState = new PersistedState<CustomPresetType[]>(
	CUSTOM_PRESETS_KEY,
	initialCustomPresets,
);

class CustomPresetsStore {
	get presets(): CustomPresetType[] {
		return persistedCustomPresetsState.current;
	}

	addPreset(name: string, rawJson: string): CustomPresetType {
		const key = `custom-${Date.now()}`;
		const newPreset: CustomPresetType = { key, name, rawJson };
		const current = [...persistedCustomPresetsState.current, newPreset];
		persistedCustomPresetsState.current = current;
		return newPreset;
	}

	updatePreset(key: string, rawJson: string): void {
		const current = persistedCustomPresetsState.current;
		const index = current.findIndex((p) => p.key === key);
		if (index === -1) return;
		current[index] = { ...current[index], rawJson };
		persistedCustomPresetsState.current = [...current];
	}

	deletePreset(key: string): void {
		const current = persistedCustomPresetsState.current;
		persistedCustomPresetsState.current = current.filter((p) => p.key !== key);
	}

	getPreset(key: string): CustomPresetType | undefined {
		return persistedCustomPresetsState.current.find((p) => p.key === key);
	}

	savePreset(key: string, name: string, rawJson: string): void {
		const current = persistedCustomPresetsState.current;
		const index = current.findIndex((p) => p.key === key);
		if (index === -1) {
			persistedCustomPresetsState.current = [...current, { key, name, rawJson }];
		} else {
			current[index] = { ...current[index], rawJson };
			persistedCustomPresetsState.current = [...current];
		}
	}
}

export const customPresetsStore = new CustomPresetsStore();
