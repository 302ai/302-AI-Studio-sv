class ElectronStorage {
	private cache = new Map<string, string>();
	private initialized = false;

	async ensureInitialized() {
		if (this.initialized || !window.electronAPI.storage) return;

		try {
			const keys = await window.electronAPI.storage.keys();
			for (const key of keys) {
				const value = await window.electronAPI.storage.getItem(key);
				if (value !== null) {
					this.cache.set(key, value);
				}
			}
			this.initialized = true;
		} catch (error) {
			console.warn("Failed to initialize electron storage:", error);
		}
	}

	async getItem(key: string): Promise<string | null> {
		if (!window.electronAPI.storage) return localStorage.getItem(key);

		await this.ensureInitialized();

		if (this.cache.has(key)) {
			return this.cache.get(key) || null;
		}

		try {
			const value = await window.electronAPI.storage.getItem(key);
			if (value !== null) {
				this.cache.set(key, value);
			}
			return value;
		} catch (error) {
			console.warn("Storage getItem error:", error);
			return null;
		}
	}

	async setItem(key: string, value: string): Promise<void> {
		if (!window.electronAPI.storage) {
			localStorage.setItem(key, value);
			return;
		}

		this.cache.set(key, value);

		try {
			await window.electronAPI.storage.setItem(key, value);
		} catch (error) {
			console.warn("Storage setItem error:", error);
			this.cache.delete(key);
		}
	}

	async removeItem(key: string): Promise<void> {
		if (!window.electronAPI.storage) {
			localStorage.removeItem(key);
			return;
		}

		this.cache.delete(key);

		try {
			await window.electronAPI.storage.removeItem(key);
		} catch (error) {
			console.warn("Storage removeItem error:", error);
		}
	}

	async clear(): Promise<void> {
		if (!window.electronAPI.storage) {
			localStorage.clear();
			return;
		}

		this.cache.clear();

		try {
			await window.electronAPI.storage.clear();
		} catch (error) {
			console.warn("Storage clear error:", error);
		}
	}

	async key(index: number): Promise<string | null> {
		if (!window.electronAPI.storage) return localStorage.key(index);

		await this.ensureInitialized();
		const keys = Array.from(this.cache.keys());
		return keys[index] || null;
	}

	get length(): number {
		if (!window.electronAPI.storage) return localStorage.length;
		return this.cache.size;
	}

	getItemSync(key: string): string | null {
		if (!window.electronAPI.storage) return localStorage.getItem(key);
		return this.cache.get(key) || null;
	}

	setItemSync(key: string, value: string): void {
		if (!window.electronAPI.storage) {
			localStorage.setItem(key, value);
			return;
		}

		this.cache.set(key, value);
		window.electronAPI.storage.setItem(key, value).catch((error: unknown) => {
			console.warn("Storage setItem error:", error);
			this.cache.delete(key);
		});
	}

	removeItemSync(key: string): void {
		if (!window.electronAPI.storage) {
			localStorage.removeItem(key);
			return;
		}

		this.cache.delete(key);
		window.electronAPI.storage.removeItem(key).catch((error: unknown) => {
			console.warn("Storage removeItem error:", error);
		});
	}

	clearSync(): void {
		if (!window.electronAPI.storage) {
			localStorage.clear();
			return;
		}

		this.cache.clear();
		window.electronAPI.storage.clear().catch((error: unknown) => {
			console.warn("Storage clear error:", error);
		});
	}

	keySync(index: number): string | null {
		if (!window.electronAPI.storage) return localStorage.key(index);
		const keys = Array.from(this.cache.keys());
		return keys[index] || null;
	}
}

const electronStorage = new ElectronStorage();

export async function polyfillLocalStorage() {
	if (window.electronAPI.storage) {
		await electronStorage.ensureInitialized();

		const storageProxy = new Proxy(electronStorage, {
			get(target, prop) {
				switch (prop) {
					case "getItem":
						return target.getItemSync.bind(target);
					case "setItem":
						return target.setItemSync.bind(target);
					case "removeItem":
						return target.removeItemSync.bind(target);
					case "clear":
						return target.clearSync.bind(target);
					case "key":
						return target.keySync.bind(target);
					case "length":
						return target.length;
					default:
						return target[prop as keyof ElectronStorage];
				}
			},
		});

		Object.defineProperty(window, "localStorage", {
			value: storageProxy,
			writable: false,
			configurable: false,
		});

		console.log("localStorage polyfilled with Electron storage");
	}
}

export const asyncStorage = {
	getItem: (key: string) => electronStorage.getItem(key),
	setItem: (key: string, value: string) => electronStorage.setItem(key, value),
	removeItem: (key: string) => electronStorage.removeItem(key),
	clear: () => electronStorage.clear(),
	key: (index: number) => electronStorage.key(index),
	get length() {
		return electronStorage.length;
	},
};
