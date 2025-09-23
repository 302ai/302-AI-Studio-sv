import { createStorage, type StorageMeta, type StorageValue } from "@302ai/unstorage";
import fsLiteDriver from "@302ai/unstorage/drivers/fs-lite";
import { isDev } from "@electron/main/constants";
import type { MigrationConfig, StorageItem, StorageMetadata, StorageOptions } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { app, webContents } from "electron";
import { join } from "path";
import { getStorageVersion, setStorageVersion } from "./migration-utils";

export class StorageService<T extends StorageValue> {
	protected storage;
	protected watches = new Map<string, () => void>();
	protected migrationConfig?: MigrationConfig<T>;

	constructor(migrationConfig?: MigrationConfig<T>) {
		const storagePath = isDev
			? join(process.cwd(), "storage")
			: join(app.getPath("userData"), "storage");
		this.storage = createStorage<T>({
			driver: fsLiteDriver({
				base: storagePath,
			}),
		});
		this.migrationConfig = migrationConfig;
	}

	private ensureJsonExtension(key: string): string {
		return key.endsWith(".json") ? key : `${key}.json`;
	}

	async setItem(event: IpcMainInvokeEvent, key: string, value: T): Promise<void> {
		const versionedValue = this.addVersionIfNeeded(value);
		await this.storage.setItem(this.ensureJsonExtension(key), versionedValue);

		const allWebContents = webContents.getAllWebContents();
		allWebContents.forEach((wc) => {
			if (wc !== event.sender && !wc.isDestroyed()) {
				wc.send(`sync:${key}`, versionedValue);
			}
		});
	}

	async getItem(_event: IpcMainInvokeEvent, key: string): Promise<T | null> {
		const value = await this.storage.getItem<T>(this.ensureJsonExtension(key));
		return await this.migrateIfNeeded(key, value);
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

	async setItems(_event: IpcMainInvokeEvent, items: StorageItem<T>[]): Promise<void> {
		const formattedItems = items.map((item) => ({
			key: this.ensureJsonExtension(item.key),
			value: item.value,
			options: {},
		}));
		await this.storage.setItems(formattedItems);
	}

	async watch(_event: IpcMainInvokeEvent, watchKey: string): Promise<void> {
		const jsonKey = this.ensureJsonExtension(watchKey);
		if (this.watches.has(watchKey)) return;
		const unwatch = await this.storage.watch(async (_event, key) => {
			if (key === jsonKey) {
				// const newValue = await this.storage.getItem<T>(jsonKey);
				// TODO
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
		const value = await this.storage.getItem<T>(this.ensureJsonExtension(key));
		return await this.migrateIfNeeded(key, value);
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

	private addVersionIfNeeded(value: T): T {
		if (!this.migrationConfig) {
			return value;
		}

		return setStorageVersion(value, this.migrationConfig.version);
	}
}

export const storageService = new StorageService();
