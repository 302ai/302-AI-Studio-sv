import { createStorage, type StorageMeta, type StorageValue } from "@302ai/unstorage";
import fsDriver from "@302ai/unstorage/drivers/fs";
import { isDev } from "@electron/main/constants";
import type { MigrationConfig, StorageItem, StorageMetadata, StorageOptions } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { join } from "path";
import { userDataManager } from "../app-service/user-data-manager";
import { emitter } from "../broadcast-service";
import { getStorageVersion, setStorageVersion } from "./migration-utils";

export class StorageService<T extends StorageValue> {
	protected storage;
	protected watches = new Map<string, () => void>();
	protected migrationConfig?: MigrationConfig<T>;
	protected lastUpdateSource = new Map<string, number>();

	constructor(migrationConfig?: MigrationConfig<T>) {
		const storagePath = isDev
			? join(process.cwd(), "storage")
			: join(userDataManager.storagePath, "storage");
		this.storage = createStorage<T>({
			driver: fsDriver({
				base: storagePath,
			}),
		});
		this.migrationConfig = migrationConfig;
	}

	protected ensureJsonExtension(key: string): string {
		return key.endsWith(".json") ? key : `${key}.json`;
	}

	async setItem(event: IpcMainInvokeEvent, key: string, value: T): Promise<void> {
		const versionedValue = this.addVersionIfNeeded(value);
		const jsonKey = this.ensureJsonExtension(key);

		this.lastUpdateSource.set(jsonKey, event.sender.id);

		await this.storage.setItem(jsonKey, versionedValue);
	}

	async getItem(_event: IpcMainInvokeEvent, key: string): Promise<T | null> {
		try {
			const value = await this.storage.getItem<T>(this.ensureJsonExtension(key));
			return await this.migrateIfNeeded(key, value);
		} catch (error) {
			console.error("Failed to get item from storage:", error);
			return null;
		}
	}

	async hasItem(_event: IpcMainInvokeEvent, key: string): Promise<boolean> {
		return await this.storage.hasItem(this.ensureJsonExtension(key));
	}

	async removeItem(
		_event: IpcMainInvokeEvent,
		key: string,
		options: StorageOptions = {},
	): Promise<void> {
		await this.storage.removeItem(this.ensureJsonExtension(key), options);
	}

	async getKeys(_event: IpcMainInvokeEvent, base?: string): Promise<string[]> {
		return await this.storage.getKeys(base);
	}

	async clear(_event: IpcMainInvokeEvent, base?: string): Promise<void> {
		await this.storage.clear(base);
	}

	async getMeta(_event: IpcMainInvokeEvent, key: string): Promise<StorageMetadata> {
		return await this.storage.getMeta(this.ensureJsonExtension(key));
	}

	async setMeta(_event: IpcMainInvokeEvent, key: string, metadata: StorageMeta): Promise<void> {
		await this.storage.setMeta(this.ensureJsonExtension(key), metadata);
	}

	async removeMeta(_event: IpcMainInvokeEvent, key: string): Promise<void> {
		await this.storage.removeMeta(this.ensureJsonExtension(key));
	}

	async getItems(_event: IpcMainInvokeEvent, keys: string[]): Promise<StorageItem<T>[]> {
		const jsonKeys = keys.map((key) => this.ensureJsonExtension(key));
		const items = await this.storage.getItems(jsonKeys);
		return items.map((item) => ({
			key: item.key,
			value: item.value,
		}));
	}

	async setItems(event: IpcMainInvokeEvent, items: StorageItem<T>[]): Promise<void> {
		const formattedItems = items.map((item) => ({
			key: this.ensureJsonExtension(item.key),
			value: item.value,
			options: {},
		}));

		formattedItems.forEach((item) => {
			this.lastUpdateSource.set(item.key, event.sender.id);
		});

		await this.storage.setItems(formattedItems);
	}

	async watch(_event: IpcMainInvokeEvent, watchKey: string): Promise<void> {
		const jsonKey = this.ensureJsonExtension(watchKey);

		if (this.watches.has(watchKey)) return;
		const unwatch = await this.storage.watch(async (_event, key) => {
			if (key === jsonKey) {
				const sendKey = key.split(".")[0];
				const sourceWebContentsId = this.lastUpdateSource.get(jsonKey) ?? -1;

				emitter.emit("persisted-state:sync", {
					sendKey,
					syncValue: await this.getItemInternal(key),
					sourceWebContentsId,
				});

				this.lastUpdateSource.delete(jsonKey);
			}
		});
		this.watches.set(watchKey, unwatch);
	}

	async unwatch(_event: IpcMainInvokeEvent, watchKey: string): Promise<void> {
		const unwatch = this.watches.get(watchKey);
		if (unwatch) {
			unwatch();
			this.watches.delete(watchKey);
		}
	}

	async dispose(): Promise<void> {
		await this.storage.dispose();
	}

	// Internal methods for main process usage (without IPC event parameter)
	async getItemInternal(key: string): Promise<T | null> {
		try {
			const value = await this.storage.getItem<T>(this.ensureJsonExtension(key));
			return await this.migrateIfNeeded(key, value);
		} catch (error) {
			// Handle JSON parsing errors from corrupted files
			if (error instanceof SyntaxError) {
				console.error(
					`Failed to parse storage file "${key}": ${error.message}. The file may be corrupted.`,
				);
				return null;
			}
			// Re-throw other errors
			throw error;
		}
	}

	async setItemInternal(key: string, value: T): Promise<void> {
		const versionedValue = this.addVersionIfNeeded(value);
		await this.storage.setItem(this.ensureJsonExtension(key), versionedValue);
	}

	async hasItemInternal(key: string): Promise<boolean> {
		return await this.storage.hasItem(this.ensureJsonExtension(key));
	}

	async removeItemInternal(key: string, options: StorageOptions = {}): Promise<void> {
		await this.storage.removeItem(this.ensureJsonExtension(key), options);
	}

	private async migrateIfNeeded(key: string, value: T | null): Promise<T | null> {
		if (!value || !this.migrationConfig) {
			return value;
		}

		try {
			const currentVersion = this.migrationConfig.version;
			const persistedVersion = getStorageVersion(value);

			if (persistedVersion === currentVersion) {
				return value;
			}

			if (this.migrationConfig.debug) {
				console.log(
					`[StorageService] Migrating from version ${persistedVersion} to ${currentVersion}`,
				);
			}

			const migratedValue = this.migrationConfig.migrate(value, currentVersion);

			// 保存迁移后的数据回原位置
			if (migratedValue !== value) {
				await this.storage.setItem(this.ensureJsonExtension(key), migratedValue);
				if (this.migrationConfig.debug) {
					console.log(`[StorageService] Migration completed and saved for key: ${key}`);
				}
			}

			return migratedValue;
		} catch (error) {
			if (this.migrationConfig.debug) {
				console.error("[StorageService] Migration failed:", error);
			}
			return value;
		}
	}

	protected addVersionIfNeeded(value: T): T {
		if (!this.migrationConfig) {
			return value;
		}

		return setStorageVersion(value, this.migrationConfig.version);
	}
}

export const storageService = new StorageService();
