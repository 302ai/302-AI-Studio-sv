import { PersistedState } from "$lib/hooks/persisted-state.svelte";

const persistedDataSettings = new PersistedState<{
	showOldDataCheckModal: boolean;
}>("DataSettingsStorage:state", {
	showOldDataCheckModal: false,
});

class DataSettingsManager {
	get state(): {
		showOldDataCheckModal: boolean;
	} {
		return persistedDataSettings.current;
	}

	setShowOldDataCheckModal(value: boolean): void {
		persistedDataSettings.current = {
			...persistedDataSettings.current,
			showOldDataCheckModal: value,
		};
	}
}

export const dataSettings = new DataSettingsManager();
