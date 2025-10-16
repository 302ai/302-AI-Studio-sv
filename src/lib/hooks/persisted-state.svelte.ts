import type { StorageValue } from "@302ai/unstorage";
import { isEqual } from "es-toolkit";
import superjson from "superjson";
import { createSubscriber } from "svelte/reactivity";

const { onPersistedStateSync } = window.electronAPI;

class ElectronStorageAdapter<T extends StorageValue> {
	private storageService = window.electronAPI.storageService;

	async getItemAsync(key: string): Promise<T | null> {
		return (await this.storageService.getItem(key)) as T;
	}

	async setItemAsync(key: string, value: T | null): Promise<void> {
		// Convert proxies to plain objects for serialization
		const serializedValue = value ? (superjson.parse(superjson.stringify(value)) as T) : value;
		await this.storageService.setItem(key, serializedValue);
	}

	async removeItemAsync(key: string): Promise<void> {
		await this.storageService.removeItem(key, {});
	}

	async clearAsync(): Promise<void> {
		await this.storageService.clear("");
	}

	async watch(key: string): Promise<void> {
		await this.storageService.watch(key);
	}
}

function proxy<T>(
	value: unknown,
	root: T | undefined,
	proxies: WeakMap<WeakKey, unknown>,
	subscribe: VoidFunction | undefined,
	update: VoidFunction | undefined,
	store: (root?: T | undefined) => void,
): T {
	if (value === null || typeof value !== "object") {
		return value as T;
	}
	const proto = Object.getPrototypeOf(value);
	if (proto !== null && proto !== Object.prototype && !Array.isArray(value)) {
		return value as T;
	}
	let p = proxies.get(value);
	if (!p) {
		p = new Proxy(value, {
			get: (target, property) => {
				subscribe?.();
				return proxy(Reflect.get(target, property), root, proxies, subscribe, update, store);
			},
			set: (target, property, value) => {
				update?.();
				Reflect.set(target, property, value);
				store(root);
				return true;
			},
		});
		proxies.set(value, p);
	}
	return p as T;
}

export class PersistedState<T extends StorageValue> {
	#current: T | undefined;
	#key: string;
	#storage?: ElectronStorageAdapter<T>;
	#subscribe?: VoidFunction;
	#update: VoidFunction | undefined;
	#proxies = new WeakMap();
	#isHydrated = $state(false);

	constructor(key: string, initialValue: T) {
		this.#current = initialValue;
		this.#key = key;
		this.#storage = new ElectronStorageAdapter<T>();

		this.#hydratePersistState(key, initialValue);

		this.#subscribe = createSubscriber((update) => {
			this.#update = update;

			console.log("watching key:", key);
			this.#storage?.watch(key);

			const unsubscribe = onPersistedStateSync<T>(key, (newValue) => {
				if (isEqual(newValue, this.#current)) return;
				console.log("Synced key:", key, "Synced value:", newValue);
				this.#current = newValue;
				this.#update?.();
			});

			return () => {
				this.#update = undefined;
				unsubscribe?.();
			};
		});
	}

	get current(): T {
		this.#subscribe?.();
		const root = this.#current;
		return proxy(
			root,
			root,
			this.#proxies,
			this.#subscribe?.bind(this),
			this.#update?.bind(this),
			this.#store.bind(this),
		);
	}

	get isHydrated(): boolean {
		return this.#isHydrated;
	}

	set current(newValue: T) {
		this.#current = newValue;
		this.#store(newValue);
		this.#update?.();
	}

	async #hydratePersistState(key: string, initialValue: T): Promise<void> {
		try {
			const electronStorage = this.#storage;
			const existingValue = await electronStorage?.getItemAsync(key);
			if (existingValue == null) {
				await electronStorage?.setItemAsync(key, initialValue);
				this.#isHydrated = true;
				return;
			}

			if (!isEqual(existingValue, initialValue)) {
				this.#current = existingValue;
				this.#update?.();
			}
			this.#isHydrated = true;
		} catch (error) {
			console.error(`Error hydrate persisted state from Electron storage for key "${key}":`, error);
			this.#current = initialValue;
			this.#isHydrated = true;
		}
	}

	#store(value: T | undefined | null): void {
		this.#storage?.setItemAsync(this.#key, value ?? null).catch((error) => {
			console.log("Value", value);
			console.error(
				`Error when writing value from persisted store "${this.#key}" to Electron storage`,
				error,
			);
		});
	}
}
