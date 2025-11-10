import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { applyLocale } from "$lib/i18n";
import { getLocale } from "$lib/paraglide/runtime";
import type {
	GeneralSettingsState,
	LanguageCode,
	LayoutMode,
	UpdateChannel,
} from "@shared/storage/general-settings";

const { generalSettingsService } = window.electronAPI;

const getDefaults = (): GeneralSettingsState => ({
	layoutMode: "default",
	language: (getLocale() as LanguageCode) ?? "zh",
	privacyAutoInherit: false,
	autoUpdate: false,
	updateChannel: "stable",
});

const persistedGeneralSettings = new PersistedState<GeneralSettingsState>(
	"GeneralSettingsStorage:state",
	getDefaults(),
);

function applyLayout(mode: LayoutMode): void {
	const el = document.documentElement;
	el.dataset.layout = mode;
}

$effect.root(() => {
	$effect(() => {
		const { language, layoutMode } = persistedGeneralSettings.current;
		try {
			if (getLocale() !== language) {
				applyLocale(language as "zh" | "en");
			}
		} catch (error) {
			console.error("Failed to set locale:", error);
		}

		applyLayout(layoutMode);
	});
});

class GeneralSettingsManager {
	get state(): GeneralSettingsState {
		return persistedGeneralSettings.current;
	}

	get layoutMode(): LayoutMode {
		return persistedGeneralSettings.current.layoutMode;
	}

	setLayoutMode(mode: LayoutMode): void {
		persistedGeneralSettings.current = { ...persistedGeneralSettings.current, layoutMode: mode };
	}

	get language(): LanguageCode {
		return persistedGeneralSettings.current.language;
	}

	setLanguage(lang: LanguageCode): void {
		if (persistedGeneralSettings.current.language === lang) return;

		persistedGeneralSettings.current = { ...persistedGeneralSettings.current, language: lang };

		generalSettingsService.handleLanguageChanged(lang);

		applyLocale(lang as "zh" | "en");
	}

	get privacyAutoInherit(): boolean {
		return persistedGeneralSettings.current.privacyAutoInherit;
	}

	setPrivacyAutoInherit(value: boolean): void {
		persistedGeneralSettings.current = {
			...persistedGeneralSettings.current,
			privacyAutoInherit: value,
		};
	}

	get autoUpdate(): boolean {
		return persistedGeneralSettings.current.autoUpdate;
	}

	setAutoUpdate(value: boolean): void {
		persistedGeneralSettings.current = { ...persistedGeneralSettings.current, autoUpdate: value };
		// Notify main process to enable/disable auto-check
		window.electronAPI.updaterService.setAutoUpdate(value);
	}

	get updateChannel(): UpdateChannel {
		return persistedGeneralSettings.current.updateChannel ?? "stable";
	}

	setUpdateChannel(channel: UpdateChannel): void {
		persistedGeneralSettings.current = {
			...persistedGeneralSettings.current,
			updateChannel: channel,
		};
		// Notify main process to change update channel
		window.electronAPI.updaterService.setUpdateChannel(channel);
	}

	update(partial: Partial<GeneralSettingsState>): void {
		persistedGeneralSettings.current = { ...persistedGeneralSettings.current, ...partial };
	}
}

export const generalSettings = new GeneralSettingsManager();
