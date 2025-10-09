import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Model } from "@shared/types";

export type SearchProvider = "search1api" | "tavily" | "exa" | "bochaai";
export type StreamSpeed = "slow" | "normal" | "fast";
export type TitleGenerationTiming = "firstTime" | "everyTime" | "off";

export interface PreferencesSettingsState {
	autoHideCode: boolean;
	autoHideReason: boolean;
	autoCollapseThink: boolean;
	autoDisableMarkdown: boolean;
	enableSupermarket: boolean;
	newSessionModel: Model | null;
	autoParseUrl: boolean;
	searchProvider: SearchProvider;
	streamOutputEnabled: boolean;
	streamSpeed: StreamSpeed;
	titleGenerationModel: Model | null;
	titleGenerationTiming: TitleGenerationTiming;
}

const getDefaults = (): PreferencesSettingsState => ({
	autoHideCode: false,
	autoHideReason: false,
	autoCollapseThink: false,
	autoDisableMarkdown: false,
	enableSupermarket: false,
	newSessionModel: null,
	autoParseUrl: false,
	searchProvider: "search1api",
	streamOutputEnabled: false,
	streamSpeed: "normal",
	titleGenerationModel: null,
	titleGenerationTiming: "firstTime",
});

const persistedPreferencesSettings = new PersistedState<PreferencesSettingsState>(
	"PreferencesSettingsStorage:state",
	getDefaults(),
);

class PreferencesSettingsManager {
	get state(): PreferencesSettingsState {
		return persistedPreferencesSettings.current;
	}

	get autoHideCode(): boolean {
		return persistedPreferencesSettings.current.autoHideCode;
	}

	setAutoHideCode(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			autoHideCode: value,
		};
	}

	get autoHideReason(): boolean {
		return persistedPreferencesSettings.current.autoHideReason;
	}

	setAutoHideReason(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			autoHideReason: value,
		};
	}

	get autoCollapseThink(): boolean {
		return persistedPreferencesSettings.current.autoCollapseThink;
	}

	setAutoCollapseThink(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			autoCollapseThink: value,
		};
	}

	get autoDisableMarkdown(): boolean {
		return persistedPreferencesSettings.current.autoDisableMarkdown;
	}

	setAutoDisableMarkdown(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			autoDisableMarkdown: value,
		};
	}

	get enableSupermarket(): boolean {
		return persistedPreferencesSettings.current.enableSupermarket;
	}

	setEnableSupermarket(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			enableSupermarket: value,
		};
	}

	get newSessionModel(): Model | null {
		return persistedPreferencesSettings.current.newSessionModel;
	}

	setNewSessionModel(model: Model | null): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			newSessionModel: model,
		};
	}

	get autoParseUrl(): boolean {
		return persistedPreferencesSettings.current.autoParseUrl;
	}

	setAutoParseUrl(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			autoParseUrl: value,
		};
	}

	get searchProvider(): SearchProvider {
		return persistedPreferencesSettings.current.searchProvider;
	}

	setSearchProvider(provider: SearchProvider): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			searchProvider: provider,
		};
	}

	get streamOutputEnabled(): boolean {
		return persistedPreferencesSettings.current.streamOutputEnabled;
	}

	setStreamOutputEnabled(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			streamOutputEnabled: value,
		};
	}

	get streamSpeed(): StreamSpeed {
		return persistedPreferencesSettings.current.streamSpeed;
	}

	setStreamSpeed(speed: StreamSpeed): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			streamSpeed: speed,
		};
	}

	get titleGenerationModel(): Model | null {
		return persistedPreferencesSettings.current.titleGenerationModel;
	}

	setTitleGenerationModel(model: Model | null): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			titleGenerationModel: model,
		};
	}

	get titleGenerationTiming(): TitleGenerationTiming {
		return persistedPreferencesSettings.current.titleGenerationTiming;
	}

	setTitleGenerationTiming(timing: TitleGenerationTiming): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			titleGenerationTiming: timing,
		};
	}

	update(partial: Partial<PreferencesSettingsState>): void {
		persistedPreferencesSettings.current = { ...persistedPreferencesSettings.current, ...partial };
	}
}

export const preferencesSettings = new PreferencesSettingsManager();
