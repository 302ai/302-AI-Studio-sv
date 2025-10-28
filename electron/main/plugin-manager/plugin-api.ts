/**
 * Plugin API Implementation
 *
 * Provides safe APIs for plugins to interact with the application
 */

import type {
	InstalledPlugin,
	PluginAPI,
	PluginStorageAPI,
	PluginHookAPI,
	PluginUIAPI,
	PluginLoggerAPI,
	PluginHttpAPI,
	PluginI18nAPI,
	HookHandler,
	DialogOptions,
	DialogResult,
	WindowOptions,
	RequestOptions,
} from "@302ai/studio-plugin-sdk";
import type { IHookManager } from "./types";
import { dialog, BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { storageService } from "../services/storage-service";
import { broadcastService } from "../services/broadcast-service";

/**
 * Create a dummy IPC event for internal API calls
 * (StorageService methods expect IpcMainInvokeEvent as first parameter)
 */
function createDummyEvent(): IpcMainInvokeEvent {
	return {
		sender: {
			id: -1, // Internal call marker
		},
	} as IpcMainInvokeEvent;
}

/**
 * Create plugin API for a specific plugin
 */
export function createPluginAPI(plugin: InstalledPlugin, hookManager: IHookManager): PluginAPI {
	return {
		metadata: plugin.metadata,
		storage: createStorageAPI(plugin),
		hooks: createHookAPI(plugin, hookManager),
		ui: createUIAPI(plugin),
		logger: createLoggerAPI(plugin),
		http: createHttpAPI(plugin),
		i18n: createI18nAPI(plugin),
	};
}

/**
 * Create storage API
 */
function createStorageAPI(plugin: InstalledPlugin): PluginStorageAPI {
	const configPrefix = `plugin:${plugin.metadata.id}:config:`;
	const dataPrefix = `plugin:${plugin.metadata.id}:data:`;
	const dummyEvent = createDummyEvent();

	return {
		async getConfig<T = unknown>(key: string): Promise<T | null> {
			return (await storageService.getItem(dummyEvent, configPrefix + key)) as T | null;
		},

		async setConfig<T = unknown>(key: string, value: T): Promise<void> {
			await storageService.setItem(dummyEvent, configPrefix + key, value as never);
			// Update plugin config
			plugin.config[key] = value;
		},

		async removeConfig(key: string): Promise<void> {
			await storageService.removeItem(dummyEvent, configPrefix + key, {});
			delete plugin.config[key];
		},

		async getAllConfig(): Promise<Record<string, unknown>> {
			return { ...plugin.config };
		},

		async getData<T = unknown>(key: string): Promise<T | null> {
			return (await storageService.getItem(dummyEvent, dataPrefix + key)) as T | null;
		},

		async setData<T = unknown>(key: string, value: T): Promise<void> {
			await storageService.setItem(dummyEvent, dataPrefix + key, value as never);
		},

		async removeData(key: string): Promise<void> {
			await storageService.removeItem(dummyEvent, dataPrefix + key, {});
		},
	};
}

/**
 * Create hook API
 */
function createHookAPI(plugin: InstalledPlugin, hookManager: IHookManager): PluginHookAPI {
	return {
		register<T = unknown>(hookName: string, handler: HookHandler<T>): void {
			hookManager.register(hookName, plugin.metadata.id, handler);
		},

		unregister(hookName: string, _handler: HookHandler): void {
			hookManager.unregister(hookName, plugin.metadata.id);
		},

		async trigger<T = unknown>(hookName: string, context: T): Promise<T> {
			// Only allow plugins to trigger custom hooks, not system hooks
			if (hookName.startsWith("provider:") || hookName.startsWith("system:")) {
				throw new Error(`Cannot trigger system hook: ${hookName}`);
			}

			return await hookManager.execute(hookName, context);
		},
	};
}

/**
 * Create UI API
 */
function createUIAPI(plugin: InstalledPlugin): PluginUIAPI {
	// Component registry (to be integrated with UI layer)
	const componentRegistry = new Map<string, typeof import("svelte").SvelteComponent>();

	return {
		registerComponent(name: string, component: typeof import("svelte").SvelteComponent): void {
			if (componentRegistry.has(name)) {
				console.warn(`[PluginAPI] Component ${name} already registered, overwriting...`);
			}

			componentRegistry.set(name, component);
			console.log(`[PluginAPI] Registered component: ${name} for plugin ${plugin.metadata.id}`);
		},

		showNotification(
			message: string,
			type: "info" | "success" | "warning" | "error" = "info",
		): void {
			// Broadcast notification to all renderer processes
			broadcastService.broadcastChannelToAll("plugin:notification", {
				pluginId: plugin.metadata.id,
				pluginName: plugin.metadata.name,
				message,
				type,
			});
			console.log(`[PluginAPI] Notification from ${plugin.metadata.name}: [${type}] ${message}`);
		},

		async showDialog(options: DialogOptions): Promise<DialogResult> {
			const result = await dialog.showMessageBox({
				type: options.type || "info",
				title: options.title,
				message: options.message,
				buttons: options.buttons || ["OK"],
				defaultId: options.defaultId,
				cancelId: options.cancelId,
			});

			return {
				response: result.response,
				cancelled: result.response === (options.cancelId ?? -1),
			};
		},

		async openWindow(options: WindowOptions): Promise<void> {
			const win = new BrowserWindow({
				width: options.width || 800,
				height: options.height || 600,
				title: options.title,
				modal: options.modal,
				webPreferences: {
					nodeIntegration: false,
					contextIsolation: true,
					sandbox: true,
				},
			});

			await win.loadURL(options.url);
		},
	};
}

/**
 * Create logger API
 */
function createLoggerAPI(plugin: InstalledPlugin): PluginLoggerAPI {
	const prefix = `[Plugin:${plugin.metadata.name}]`;

	return {
		debug(message: string, ...args: unknown[]): void {
			console.debug(prefix, message, ...args);
		},

		info(message: string, ...args: unknown[]): void {
			console.log(prefix, message, ...args);
		},

		warn(message: string, ...args: unknown[]): void {
			console.warn(prefix, message, ...args);
		},

		error(message: string, ...args: unknown[]): void {
			console.error(prefix, message, ...args);
		},
	};
}

/**
 * Create HTTP client API
 */
function createHttpAPI(plugin: InstalledPlugin): PluginHttpAPI {
	async function request<T = unknown>(options: RequestOptions): Promise<T> {
		const {
			url,
			method = "GET",
			headers = {},
			body,
			params,
			timeout = 30000,
			responseType = "json",
		} = options;

		if (!url) {
			throw new Error("URL is required");
		}

		// Build URL with query parameters
		let requestUrl = url;
		if (params) {
			const searchParams = new URLSearchParams();
			for (const [key, value] of Object.entries(params)) {
				searchParams.append(key, String(value));
			}
			requestUrl += `?${searchParams.toString()}`;
		}

		// Create abort controller for timeout
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			const response = await fetch(requestUrl, {
				method,
				headers: {
					"User-Agent": `302-AI-Studio-Plugin/${plugin.metadata.id}`,
					...headers,
				},
				body: body ? JSON.stringify(body) : undefined,
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			// Parse response based on type
			let data: T;
			switch (responseType) {
				case "json":
					data = (await response.json()) as T;
					break;
				case "text":
					data = (await response.text()) as T;
					break;
				case "blob":
					data = (await response.blob()) as T;
					break;
				case "arraybuffer":
					data = (await response.arrayBuffer()) as T;
					break;
				default:
					data = (await response.json()) as T;
			}

			return data;
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") {
				throw new Error("Request timeout");
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}

	return {
		async get<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
			return request<T>({ ...options, url, method: "GET" });
		},

		async post<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
			return request<T>({ ...options, url, method: "POST", body: data });
		},

		async put<T = unknown>(url: string, data?: unknown, options?: RequestOptions): Promise<T> {
			return request<T>({ ...options, url, method: "PUT", body: data });
		},

		async delete<T = unknown>(url: string, options?: RequestOptions): Promise<T> {
			return request<T>({ ...options, url, method: "DELETE" });
		},

		request,
	};
}

/**
 * Create i18n API
 */
function createI18nAPI(_plugin: InstalledPlugin): PluginI18nAPI {
	const messages = new Map<string, Record<string, string>>();

	return {
		t(key: string, params?: Record<string, string | number>): string {
			// TODO: Integrate with application i18n system
			const currentLocale = "en"; // Get from app settings

			const localeMessages = messages.get(currentLocale);
			let message = localeMessages?.[key] || key;

			// Replace params
			if (params) {
				for (const [paramKey, paramValue] of Object.entries(params)) {
					message = message.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
				}
			}

			return message;
		},

		getLocale(): string {
			// TODO: Get from app settings
			return "en";
		},

		addMessages(locale: string, newMessages: Record<string, string>): void {
			const existing = messages.get(locale) || {};
			messages.set(locale, { ...existing, ...newMessages });
		},
	};
}
