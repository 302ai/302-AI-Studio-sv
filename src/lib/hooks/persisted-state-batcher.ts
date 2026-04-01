import type { StorageValue } from "@302ai/unstorage";

class PersistedStateBatcher {
	private pendingWrites = new Map<string, StorageValue>();
	private flushScheduled = false;
	private readonly maxBatchSize = 50;

	scheduleWrite(key: string, value: StorageValue): void {
		this.pendingWrites.set(key, value);
		if (this.pendingWrites.size >= this.maxBatchSize) {
			this.flush();
			return;
		}
		if (!this.flushScheduled) {
			this.flushScheduled = true;
			queueMicrotask(() => this.doFlush());
		}
	}

	async flush(): Promise<void> {
		if (this.flushScheduled) {
			this.flushScheduled = false;
		}
		await this.doFlush();
	}

	private async doFlush(): Promise<void> {
		if (this.pendingWrites.size === 0) return;
		const items = Array.from(this.pendingWrites.entries()).map(([key, value]) => ({
			key,
			value,
		}));
		this.pendingWrites.clear();
		this.flushScheduled = false;

		try {
			await window.electronAPI.storageService.setItems(items);
		} catch (error) {
			console.error(
				"[Batcher] Batch write failed, falling back to individual writes:",
				error,
			);
			for (const item of items) {
				try {
					await window.electronAPI.storageService.setItem(item.key, item.value);
				} catch (e) {
					console.error(`[Batcher] Failed to write ${item.key}:`, e);
				}
			}
		}
	}
}

export const batcher = new PersistedStateBatcher();
