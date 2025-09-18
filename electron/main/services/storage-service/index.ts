import { app } from "electron";
import path from "path";
import { createStorage } from "unstorage";
import fsDriver from "unstorage/drivers/fs";

export class StorageService {
	public storage;

	constructor() {
		const userDataPath = app.getPath("userData");
		const storagePath = path.join(userDataPath, "storage");
		console.log(storagePath);
		this.storage = createStorage({
			driver: fsDriver({
				base: storagePath,
			}),
		});
	}

	async getItem(_event: Electron.IpcMainInvokeEvent, key: string): Promise<string | null> {
		const value = await this.storage.getItem(key);
		if (value == null) {
			return null;
		}
		if (typeof value === "string") {
			return value;
		}
		return JSON.stringify(value);
	}

	async setItem(_event: Electron.IpcMainInvokeEvent, key: string, value: string): Promise<void> {
		await this.storage.setItem(key, value);
	}

	async removeItem(_event: Electron.IpcMainInvokeEvent, key: string): Promise<void> {
		await this.storage.removeItem(key);
	}

	async clear(_event: Electron.IpcMainInvokeEvent): Promise<void> {
		await this.storage.clear();
	}

	async key(_event: Electron.IpcMainInvokeEvent, index: number): Promise<string | null> {
		const keys = await this.storage.getKeys();
		return keys[index] || null;
	}

	async length(_event: Electron.IpcMainInvokeEvent): Promise<number> {
		const keys = await this.storage.getKeys();
		return keys.length;
	}

	async keys(_event: Electron.IpcMainInvokeEvent): Promise<string[]> {
		return await this.storage.getKeys();
	}
}
