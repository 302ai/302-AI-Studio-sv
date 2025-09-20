import { prefixStorage, ThemeState, type MigrationConfig } from "@shared/types";
import { StorageService } from ".";
import { createMigrate } from "./migration-utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
const migrations = {
	0: (state: any) => {
		if (!state) {
			return {
				theme: "system" as const,
				shouldUseDarkColors: false,
			};
		}

		if (state.darkMode !== undefined) {
			return {
				theme: state.darkMode ? "dark" : "light",
				shouldUseDarkColors: state.darkMode,
			};
		}
		return state;
	},
};

const migrationConfig: MigrationConfig<ThemeState> = {
	version: 1,
	migrate: createMigrate(migrations, { debug: true }),
	debug: true,
};

export class ThemeStorage extends StorageService<ThemeState> {
	constructor() {
		super(migrationConfig);
		this.storage = prefixStorage(this.storage, "ThemeStorage");
	}

	async getThemeState() {
		return this.getItemInternal("state");
	}

	async setThemeState(state: ThemeState) {
		return this.setItemInternal("state", state);
	}
}

export const themeStorage = new ThemeStorage();
