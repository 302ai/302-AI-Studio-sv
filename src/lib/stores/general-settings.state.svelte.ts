import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { getLocale, setLocale } from "$lib/paraglide/runtime";
import type {
	GeneralSettingsState,
	LanguageCode,
	LayoutMode,
} from "@shared/storage/general-settings";
import { untrack } from "svelte";

const { generalSettingsService } = window.electronAPI;

const getDefaults = (): GeneralSettingsState => ({
	layoutMode: "default",
	language: (getLocale() as LanguageCode) ?? "zh",
	privacyAutoInherit: false,
	autoUpdate: false,
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

		untrack(() => {
			try {
				if (getLocale() !== language) {
					setLocale(language);
				}
			} catch (error) {
				console.error("Failed to set locale:", error);
			}

			applyLayout(layoutMode);
		});
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

		generalSettingsService.handleLanguageChanged();

		setLocale(lang as "zh" | "en");
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
	}

	update(partial: Partial<GeneralSettingsState>): void {
		persistedGeneralSettings.current = { ...persistedGeneralSettings.current, ...partial };
	}
}

export const generalSettings = new GeneralSettingsManager();
