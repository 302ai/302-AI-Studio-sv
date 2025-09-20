/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StorageValue } from "@302ai/unstorage";

export type MigrationFunction<T extends StorageValue = StorageValue> = (state: any) => T;

export interface MigrationMap<T extends StorageValue = StorageValue> {
	[version: number]: MigrationFunction<T>;
}

export interface MigrateOptions {
	debug?: boolean;
	logger?: (message: string) => void;
}

export interface MigrateFunction<T extends StorageValue = StorageValue> {
	(persistedState: any, currentVersion: number): T;
}

export function createMigrate<T extends StorageValue = StorageValue>(
	migrations: MigrationMap<T>,
	options: MigrateOptions = {},
): MigrateFunction<T> {
	const { debug = false, logger = console.log } = options;

	return function migrate(persistedState: any, currentVersion: number): T {
		if (!persistedState || typeof persistedState !== "object") {
			if (debug) {
				logger(`[Migration] No persisted state found, running migration for null/undefined state`);
			}
			// 运行从版本 0 开始的迁移来创建默认状态
			let migratedState = persistedState;
			for (let version = 0; version < currentVersion; version++) {
				const migrationFunction = migrations[version];
				if (migrationFunction) {
					if (debug) {
						logger(
							`[Migration] Applying migration from version ${version} to ${version + 1} for null state`,
						);
					}
					try {
						migratedState = migrationFunction(migratedState);
					} catch (error) {
						if (debug) {
							logger(`[Migration] Error applying migration for version ${version}:`, error);
						}
						throw new Error(
							`Migration failed at version ${version}: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				}
			}
			if (migratedState && typeof migratedState === "object") {
				migratedState._version = currentVersion;
			}
			return migratedState;
		}

		const persistedVersion = getStorageVersion(persistedState);

		if (debug) {
			logger(
				`[Migration] Persisted version: ${persistedVersion}, Current version: ${currentVersion}`,
			);
		}

		if (persistedVersion === currentVersion) {
			if (debug) {
				logger(`[Migration] State is up to date, no migration needed`);
			}
			return persistedState;
		}

		if (persistedVersion > currentVersion) {
			if (debug) {
				logger(
					`[Migration] Warning: Persisted version (${persistedVersion}) is newer than current version (${currentVersion})`,
				);
			}
			return persistedState;
		}

		let migratedState = { ...persistedState };

		for (let version = persistedVersion; version < currentVersion; version++) {
			const migrationFunction = migrations[version];
			if (migrationFunction) {
				if (debug) {
					logger(`[Migration] Applying migration from version ${version} to ${version + 1}`);
				}
				try {
					migratedState = migrationFunction(migratedState);
				} catch (error) {
					if (debug) {
						logger(`[Migration] Error applying migration for version ${version}:`, error);
					}
					throw new Error(
						`Migration failed at version ${version}: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			} else {
				if (debug) {
					logger(`[Migration] No migration function found for version ${version}, skipping`);
				}
			}
		}

		migratedState._version = currentVersion;

		if (debug) {
			logger(`[Migration] Migration completed successfully to version ${currentVersion}`);
		}

		return migratedState;
	};
}

export function getStorageVersion(state: any): number {
	return state && typeof state === "object" && typeof state._version === "number"
		? state._version
		: 0;
}

export function setStorageVersion<T extends StorageValue>(state: T, version: number): T {
	if (typeof state === "object" && state !== null) {
		return { ...state, _version: version };
	}
	return state;
}
