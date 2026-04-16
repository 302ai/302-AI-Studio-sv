import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Model } from "@shared/types";
import { sessionState } from "./session-state.svelte";

export type SearchProvider = "search1api" | "tavily" | "exa" | "bochaai";
export type StreamSpeed = "slow" | "normal" | "fast";
export type TitleGenerationTiming = "firstTime" | "everyTime" | "off";
export type SuggestionsTiming = "auto" | "off";

export interface PreferencesSettingsState {
	autoHideCode: boolean;
	autoHideReason: boolean;
	autoCollapseThink: boolean;
	autoDisableMarkdown: boolean;
	enableSupermarket: boolean;
	newSessionModel: Model | null;
	vibeNewSessionModel: Model | null;
	autoParseUrl: boolean;
	searchProvider: SearchProvider;
	streamOutputEnabled: boolean;
	streamSpeed: StreamSpeed;
	titleGenerationModel: Model | null;
	titleGenerationTiming: TitleGenerationTiming;
	// Suggestions settings
	suggestionsEnabled: boolean;
	suggestionsCount: number;
	suggestionsTiming: SuggestionsTiming;
	showOnlyLastSuggestion: boolean;
	// Preview panel settings
	previewPanelPinned: boolean;
	// Context compression settings
	contextCompressionEnabled: boolean;
	contextCompressionLimit: number;
	// Default phrasing
	defaultPhrasing: string;
}

const getDefaults = (): PreferencesSettingsState => ({
	autoHideCode: true,
	autoHideReason: false,
	autoCollapseThink: false,
	autoDisableMarkdown: false,
	enableSupermarket: true,
	newSessionModel: null,
	vibeNewSessionModel: null,
	autoParseUrl: false,
	searchProvider: "search1api",
	streamOutputEnabled: false,
	streamSpeed: "normal",
	titleGenerationModel: null,
	titleGenerationTiming: "firstTime",
	// Suggestions defaults
	suggestionsEnabled: true,
	suggestionsCount: 3,
	suggestionsTiming: "auto",
	showOnlyLastSuggestion: false,
	// Preview panel defaults
	previewPanelPinned: true,
	// Context compression defaults
	contextCompressionEnabled: true,
	contextCompressionLimit: 20,
	// Default phrasing
	defaultPhrasing: "empty",
});

const persistedPreferencesSettings = new PersistedState<PreferencesSettingsState>(
	"PreferencesSettingsStorage:state",
	getDefaults(),
);

class PreferencesSettingsManager {
	get isHydrated(): boolean {
		return persistedPreferencesSettings.isHydrated;
	}

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

	get vibeNewSessionModel(): Model | null {
		return persistedPreferencesSettings.current.vibeNewSessionModel;
	}

	setVibeNewSessionModel(model: Model | null): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			vibeNewSessionModel: model,
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
		return (
			persistedPreferencesSettings.current.titleGenerationModel ??
			sessionState.latestUsedModel
		);
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

	get suggestionsEnabled(): boolean {
		return persistedPreferencesSettings.current.suggestionsEnabled;
	}

	setSuggestionsEnabled(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			suggestionsEnabled: value,
		};
	}

	get suggestionsCount(): number {
		return persistedPreferencesSettings.current.suggestionsCount;
	}

	setSuggestionsCount(count: number): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			suggestionsCount: Math.max(1, Math.min(5, count)), // Clamp between 1-5
		};
	}

	get suggestionsTiming(): SuggestionsTiming {
		return persistedPreferencesSettings.current.suggestionsTiming;
	}

	setSuggestionsTiming(timing: SuggestionsTiming): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			suggestionsTiming: timing,
		};
	}

	get showOnlyLastSuggestion(): boolean {
		return persistedPreferencesSettings.current.showOnlyLastSuggestion;
	}

	setShowOnlyLastSuggestion(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			showOnlyLastSuggestion: value,
		};
	}

	get previewPanelPinned(): boolean {
		return persistedPreferencesSettings.current.previewPanelPinned;
	}

	setPreviewPanelPinned(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			previewPanelPinned: value,
		};
	}

	togglePreviewPanelPinned(): void {
		this.setPreviewPanelPinned(!this.previewPanelPinned);
	}

	get contextCompressionEnabled(): boolean {
		return persistedPreferencesSettings.current.contextCompressionEnabled;
	}

	setContextCompressionEnabled(value: boolean): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			contextCompressionEnabled: value,
		};
	}

	get contextCompressionLimit(): number {
		return persistedPreferencesSettings.current.contextCompressionLimit;
	}

	setContextCompressionLimit(limit: number): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			contextCompressionLimit: Math.max(5, Math.min(100, limit)), // Clamp between 5-100
		};
	}

	get defaultPhrasing(): string {
		return persistedPreferencesSettings.current.defaultPhrasing;
	}

	setDefaultPhrasing(value: string): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			defaultPhrasing: value,
		};
	}

	update(partial: Partial<PreferencesSettingsState>): void {
		persistedPreferencesSettings.current = {
			...persistedPreferencesSettings.current,
			...partial,
		};
	}
}

export const preferencesSettings = new PreferencesSettingsManager();
