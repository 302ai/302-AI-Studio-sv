import type { IpcMainInvokeEvent } from "electron";
import { app } from "electron";
import { createStorage, type StorageValue, type StorageMeta } from "unstorage";
import fsLiteDriver from "unstorage/drivers/fs-lite";
import type { StorageMetadata, StorageOptions, StorageItem } from "@shared/types";
import { join } from "path";

export class StorageService {
	private storage;
	private watches = new Map<string, () => void>();

	constructor() {
		const storagePath = join(app.getPath("userData"), "storage");
		this.storage = createStorage({
			driver: fsLiteDriver({
				base: storagePath,
			}),
		});
	}

	async setItem(
		_event: IpcMainInvokeEvent,
		key: string,
		value: StorageValue | null,
	): Promise<void> {
		await this.storage.setItem(key, value);
	}

	async getItem<T = StorageValue>(_event: IpcMainInvokeEvent, key: string): Promise<T | null> {
		return await this.storage.getItem<T>(key);
	}

	async hasItem(_event: IpcMainInvokeEvent, key: string): Promise<boolean> {
		return await this.storage.hasItem(key);
	}

	async removeItem(
		_event: IpcMainInvokeEvent,
		key: string,
		options: StorageOptions = {},
	): Promise<void> {
		await this.storage.removeItem(key, options);
	}

	async getKeys(_event: IpcMainInvokeEvent, base?: string): Promise<string[]> {
		return await this.storage.getKeys(base);
	}

	async clear(_event: IpcMainInvokeEvent, base?: string): Promise<void> {
		await this.storage.clear(base);
	}

	async getMeta(_event: IpcMainInvokeEvent, key: string): Promise<StorageMetadata> {
		return await this.storage.getMeta(key);
	}

	async setMeta(_event: IpcMainInvokeEvent, key: string, metadata: StorageMeta): Promise<void> {
		await this.storage.setMeta(key, metadata);
	}

	async removeMeta(_event: IpcMainInvokeEvent, key: string): Promise<void> {
		await this.storage.removeMeta(key);
	}

	async getItems(_event: IpcMainInvokeEvent, keys: string[]): Promise<StorageItem[]> {
		const items = await this.storage.getItems(keys);
		return items.map((item) => ({
			key: item.key,
			value: item.value,
		}));
	}

	async setItems(_event: IpcMainInvokeEvent, items: StorageItem[]): Promise<void> {
		const formattedItems = items.map((item) => ({
			key: item.key,
			value: item.value,
			options: {},
		}));
		await this.storage.setItems(formattedItems);
	}

	async watch(_event: IpcMainInvokeEvent, watchKey: string): Promise<void> {
		if (this.watches.has(watchKey)) return;
		const unwatch = await this.storage.watch(async (event, key) => {
			if (key === watchKey) {
				// const newValue = await this.storage.getItem<T>(watchKey);
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
	async getItemInternal<T = StorageValue>(key: string): Promise<T | null> {
		return await this.storage.getItem<T>(key);
	}

	async setItemInternal(key: string, value: StorageValue): Promise<void> {
		await this.storage.setItem(key, value);
	}

	async hasItemInternal(key: string): Promise<boolean> {
		return await this.storage.hasItem(key);
	}

	async removeItemInternal(key: string, options: StorageOptions = {}): Promise<void> {
		await this.storage.removeItem(key, options);
	}
}

export const storageService = new StorageService();
