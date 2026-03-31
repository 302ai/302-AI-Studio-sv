import type { FSWatcher } from "chokidar";
import { watch } from "chokidar";
import { relative } from "path";

export class GlobalStorageWatcher {
	private watcher: FSWatcher | null = null;
	private subscriptions = new Map<string, Set<(key: string) => void>>();
	private debounceTimers = new Map<string, NodeJS.Timeout>();
	private readonly debounceMs = 50;

	constructor(private storagePath: string) {}

	async start(): Promise<void> {
		this.watcher = watch(this.storagePath, {
			ignoreInitial: true,
			depth: 5,
		}).on("all", (event, filePath) => {
			if (event !== "change" && event !== "add") return;
			const relativePath = relative(this.storagePath, filePath);
			const key = this.pathToKey(relativePath);
			this.notifySubscribers(key);
		});
	}

	subscribe(key: string, callback: (key: string) => void): () => void {
		if (!this.subscriptions.has(key)) {
			this.subscriptions.set(key, new Set());
		}
		this.subscriptions.get(key)!.add(callback);
		return () => {
			this.subscriptions.get(key)?.delete(callback);
			if (this.subscriptions.get(key)?.size === 0) {
				this.subscriptions.delete(key);
			}
		};
	}

	private notifySubscribers(key: string): void {
		if (this.debounceTimers.has(key)) {
			clearTimeout(this.debounceTimers.get(key)!);
		}
		this.debounceTimers.set(
			key,
			setTimeout(() => {
				this.debounceTimers.delete(key);
				const callbacks = this.subscriptions.get(key);
				if (callbacks) {
					callbacks.forEach((cb) => cb(key));
				}
			}, this.debounceMs),
		);
	}

	private pathToKey(relativePath: string): string {
		return relativePath.replace(/\\/g, "/").replace(/\//g, ":");
	}

	async dispose(): Promise<void> {
		await this.watcher?.close();
		this.subscriptions.clear();
		this.debounceTimers.forEach((t) => clearTimeout(t));
		this.debounceTimers.clear();
	}
}
