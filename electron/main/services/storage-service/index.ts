import { createStorage, type StorageMeta, type StorageValue } from "@302ai/unstorage";
import fsDriver from "@302ai/unstorage/drivers/fs";
import { isDev } from "@electron/main/constants";
import type { MigrationConfig, StorageItem, StorageMetadata, StorageOptions } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { promises as fs } from "fs";
import { join } from "path";
import { userDataManager } from "../app-service/user-data-manager";
import { emitter } from "../broadcast-service";
import { getStorageVersion, setStorageVersion } from "./migration-utils";

/**
 * Simple in-memory lock manager to serialize concurrent writes to the same file
 */
class StorageLockManager {
	private locks = new Map<string, Promise<void>>();

	/**
	 * Execute a function with exclusive lock on the specified key
	 */
	async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
		// Wait for any existing lock on this key
		while (this.locks.has(key)) {
			await this.locks.get(key);
		}

		// Create new lock promise
		let releaseLock: () => void;
		const lockPromise = new Promise<void>((resolve) => {
			releaseLock = resolve;
		});

		this.locks.set(key, lockPromise);

		try {
			// Execute the function
			return await fn();
		} finally {
			// Release the lock
			this.locks.delete(key);
			releaseLock!();
		}
	}
}

/**
 * Write queue that coalesces multiple rapid writes into batches
 * Reduces I/O operations by collecting writes over a short time window
 */
class WriteQueue<T> {
	private pendingWrites = new Map<string, { value: T; timestamp: number }>();
	private flushTimer: NodeJS.Timeout | null = null;
	private coalesceMs: number;
	private writeFunction: (key: string, value: T) => Promise<void>;

	constructor(writeFunction: (key: string, value: T) => Promise<void>, coalesceMs: number = 100) {
		this.writeFunction = writeFunction;
		this.coalesceMs = coalesceMs;
	}

	/**
	 * Schedule a write operation, coalescing with other writes in the same time window
	 */
	schedule(key: string, value: T): void {
		// Update or add to pending writes (last write wins for same key)
		this.pendingWrites.set(key, { value, timestamp: Date.now() });

		// Schedule flush if not already scheduled
		if (!this.flushTimer) {
			this.flushTimer = setTimeout(() => this.flush(), this.coalesceMs);
		}
	}

	/**
	 * Force immediate flush of all pending writes
	 */
	async flush(): Promise<void> {
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}

		if (this.pendingWrites.size === 0) {
			return;
		}

		// Copy and clear pending writes
		const writes = Array.from(this.pendingWrites.entries());
		this.pendingWrites.clear();

		// Execute all writes in parallel
		await Promise.all(
			writes.map(([key, { value }]) => this.writeFunction(key, value))
		);
	}

	/**
	 * Get number of pending writes
	 */
	get size(): number {
		return this.pendingWrites.size;
	}
}

export class StorageService<T extends StorageValue> {
	protected storage;
	protected storagePath: string;
	protected watches = new Map<string, () => void>();
	protected migrationConfig?: MigrationConfig<T>;
	protected lastUpdateSource = new Map<string, number>();
	private lockManager = new StorageLockManager();
	private writeQueue: WriteQueue<T>;

	constructor(migrationConfig?: MigrationConfig<T>) {
		this.storagePath = isDev
			? join(process.cwd(), "storage")
			: join(userDataManager.storagePath, "storage");
		this.storage = createStorage<T>({
			driver: fsDriver({
				base: this.storagePath,
			}),
		});
		this.migrationConfig = migrationConfig;

		// Initialize write queue with actual write function
		this.writeQueue = new WriteQueue<T>(
			async (key: string, value: T) => {
				await this.lockManager.withLock(key, async () => {
					await this.atomicWriteWithRetry(key, value);
				});
			},
			100 // 100ms coalesce window
		);
	}

	protected ensureJsonExtension(key: string): string {
		return key.endsWith(".json") ? key : `${key}.json`;
	}

	/**
	 * Atomic write implementation to prevent file corruption
	 * Uses write-to-temp + rename pattern which is atomic on POSIX systems
	 */
	private async atomicWrite(key: string, value: T): Promise<void> {
		const filePath = join(this.storagePath, key);
		const tempPath = `${filePath}.tmp.${Date.now()}.${process.pid}`;

		try {
			// Serialize value to JSON
			const content = JSON.stringify(value, null, 2);

			// Write to temporary file
			await fs.writeFile(tempPath, content, "utf8");

			// Fsync to ensure data is on disk
			const fileHandle = await fs.open(tempPath, "r+");
			try {
				await fileHandle.datasync();
			} finally {
				await fileHandle.close();
			}

			// Atomic rename (overwrites existing file atomically on POSIX)
			await fs.rename(tempPath, filePath);
		} catch (error) {
			// Clean up temp file if it exists
			try {
				await fs.unlink(tempPath);
			} catch {
				// Ignore cleanup errors
			}
			throw error;
		}
	}

	/**
	 * Atomic write with retry logic and exponential backoff
	 * Retries failed writes up to maxRetries times with increasing delays
	 */
	private async atomicWriteWithRetry(
		key: string,
		value: T,
		maxRetries: number = 3
	): Promise<void> {
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				await this.atomicWrite(key, value);
				return; // Success - exit
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// Don't retry on last attempt
				if (attempt === maxRetries) {
					break;
				}

				// Calculate exponential backoff delay: 100ms, 200ms, 400ms, ...
				const delayMs = Math.min(100 * Math.pow(2, attempt), 2000);

				console.warn(
					`[StorageService] Write failed for key "${key}", attempt ${attempt + 1}/${maxRetries + 1}. ` +
					`Retrying in ${delayMs}ms...`,
					lastError.message
				);

				// Wait before retry
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		// All retries exhausted
		console.error(
			`[StorageService] Write failed for key "${key}" after ${maxRetries + 1} attempts`,
			lastError
		);
		throw lastError;
	}

	async setItem(event: IpcMainInvokeEvent, key: string, value: T): Promise<void> {
		const versionedValue = this.addVersionIfNeeded(value);
		const jsonKey = this.ensureJsonExtension(key);

		this.lastUpdateSource.set(jsonKey, event.sender.id);

		// Schedule write through queue for automatic coalescing
		this.writeQueue.schedule(jsonKey, versionedValue);
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
			value: this.addVersionIfNeeded(item.value as T),
		}));

		formattedItems.forEach((item) => {
			this.lastUpdateSource.set(item.key, event.sender.id);
		});

		// Schedule all writes through queue for automatic coalescing
		formattedItems.forEach((item) => {
			this.writeQueue.schedule(item.key, item.value);
		});
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
		// Flush any pending writes before disposing
		await this.writeQueue.flush();
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
		const jsonKey = this.ensureJsonExtension(key);
		// Use lock, atomic write, and retry to prevent corruption and handle failures
		await this.lockManager.withLock(jsonKey, async () => {
			await this.atomicWriteWithRetry(jsonKey, versionedValue);
		});
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

			// Save migrated data with atomic write, lock, and retry
			if (migratedValue !== value) {
				const jsonKey = this.ensureJsonExtension(key);
				await this.lockManager.withLock(jsonKey, async () => {
					await this.atomicWriteWithRetry(jsonKey, migratedValue);
				});
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
