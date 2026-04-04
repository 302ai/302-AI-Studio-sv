import type { MigrationConfig } from "@shared/types";
import { StorageService } from ".";
import { createMigrate } from "./migration-utils";

interface PreferencesSettingsState {
	autoHideCode?: boolean;
	autoHideReason?: boolean;
	autoCollapseThink?: boolean;
	autoDisableMarkdown?: boolean;
	enableSupermarket?: boolean;
	newSessionModel?: unknown;
	vibeNewSessionModel?: unknown;
	autoParseUrl?: boolean;
	searchProvider?: string;
	streamOutputEnabled?: boolean;
	streamSpeed?: string;
	titleGenerationModel?: unknown;
	titleGenerationTiming?: string;
	suggestionsEnabled?: boolean;
	suggestionsCount?: number;
	suggestionsTiming?: string;
	showOnlyLastSuggestion?: boolean;
	previewPanelPinned?: boolean;
	contextCompressionEnabled?: boolean;
	contextCompressionLimit?: number;
	_version?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const migrations = {
	0: (state: any): PreferencesSettingsState => {
		// Migration from version 0 to 1: Add contextCompressionLimit default
		return {
			...state,
			contextCompressionEnabled: state?.contextCompressionEnabled ?? true,
			contextCompressionLimit: state?.contextCompressionLimit ?? 20,
		};
	},
};

const migrationConfig: MigrationConfig<PreferencesSettingsState> = {
	version: 1,
	migrate: createMigrate(migrations),
	debug: true,
};

export class PreferencesStorage extends StorageService<PreferencesSettingsState> {
	private static readonly STORAGE_KEY = "PreferencesSettingsStorage:state";

	constructor() {
		super(migrationConfig);
		this.migrationKey = PreferencesStorage.STORAGE_KEY;
	}

	async getState(): Promise<PreferencesSettingsState | null> {
		return this.getItemInternal(PreferencesStorage.STORAGE_KEY);
	}

	async setState(state: PreferencesSettingsState): Promise<void> {
		return this.setItemInternal(PreferencesStorage.STORAGE_KEY, state);
	}
}

export const preferencesStorage = new PreferencesStorage();
