import type { CacheInfo, LanguageCode, ProxySettings } from "@shared/storage/general-settings";
import { dialog, net, session, webContents, type IpcMainInvokeEvent } from "electron";
import { emitter } from "../broadcast-service";
import { generalSettingsStorage } from "../storage-service/general-settings-storage";
import { clearProxyAgentCache } from "../../utils/proxy-helper";
import { createLogger } from "@shared/logger";
import { cacheManager } from "../cache-manager";

const logger = createLogger("services");

export class GeneralSettingsService {
	async getLanguage(): Promise<LanguageCode> {
		const language = await generalSettingsStorage.getLanguage();
		return language;
	}

	// ******************************* IPC Methods ******************************* //

	async handleLanguageChanged(event: IpcMainInvokeEvent, language: LanguageCode): Promise<void> {
		const allWebContents = webContents.getAllWebContents();

		// Reload all webContents except the sender to apply language change
		// PersistedState will restore chat messages and thread data from storage
		allWebContents.forEach((webContent) => {
			if (webContent.id === event.sender.id) return;
			webContent.reload();
		});

		emitter.emit("general-settings:language-changed", { language });
	}

	async handleProxyChanged(
		event: IpcMainInvokeEvent,
		proxySettings: ProxySettings,
	): Promise<void> {
		await this.applyProxySettings(proxySettings);
	}

	async testProxyConnection(
		event: IpcMainInvokeEvent,
		proxySettings: ProxySettings,
	): Promise<{ success: boolean; error?: string }> {
		try {
			if (!proxySettings.host || !proxySettings.port) {
				return { success: false, error: "Invalid proxy configuration" };
			}

			// Create a temporary session to test the proxy
			const testSession = session.fromPartition("test-proxy", { cache: false });

			// Set proxy for test session
			await testSession.setProxy({
				proxyRules: `http://${proxySettings.host}:${proxySettings.port}`,
				proxyBypassRules: "localhost,127.0.0.1",
			});

			// Test connection to a reliable endpoint
			return new Promise((resolve) => {
				const request = net.request({
					method: "GET",
					url: "https://www.google.com",
					session: testSession,
				});

				const timeout = setTimeout(() => {
					request.abort();
					resolve({ success: false, error: "Connection timeout" });
				}, 10000); // 10 second timeout

				request.on("response", (response) => {
					clearTimeout(timeout);
					if (response.statusCode >= 200 && response.statusCode < 400) {
						resolve({ success: true });
					} else {
						resolve({ success: false, error: `HTTP ${response.statusCode}` });
					}
					// Consume response data to prevent memory leaks
					response.on("data", () => {});
				});

				request.on("error", (error) => {
					clearTimeout(timeout);
					resolve({ success: false, error: error.message });
				});

				request.end();
			});
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async applyProxySettings(proxySettings: ProxySettings): Promise<void> {
		if (proxySettings.enabled && proxySettings.host && proxySettings.port) {
			const proxyUrl = `http://${proxySettings.host}:${proxySettings.port}`;

			logger.info(`[Proxy] Applying proxy settings: ${proxyUrl}`);

			// Clear cached ProxyAgent to force recreation with new settings
			clearProxyAgentCache();

			// Set Electron session proxy (for browser requests like net.request)
			await session.defaultSession.setProxy({
				proxyRules: proxyUrl,
				proxyBypassRules: "localhost,127.0.0.1",
			});

			logger.info("[Proxy] Electron session proxy configured");
		} else {
			logger.info("[Proxy] Clearing proxy settings");

			// Clear cached ProxyAgent
			clearProxyAgentCache();

			// Clear Electron session proxy
			await session.defaultSession.setProxy({ proxyRules: "" });
		}
	}

	// ******************************* Cache Management ******************************* //

	async getCacheDirectory(_event: IpcMainInvokeEvent): Promise<string> {
		return cacheManager.getCacheRoot();
	}

	async setCacheDirectory(
		_event: IpcMainInvokeEvent,
		dirPath: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			await cacheManager.setCacheDirectory(dirPath);
			return { success: true };
		} catch (error) {
			logger.error("[CacheManager] Failed to set cache directory:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async getCacheInfo(_event: IpcMainInvokeEvent): Promise<CacheInfo> {
		return await cacheManager.getCacheInfo();
	}

	async clearCache(_event: IpcMainInvokeEvent): Promise<void> {
		await cacheManager.clearAllCache();
	}

	async resetCacheToDefault(_event: IpcMainInvokeEvent): Promise<void> {
		await cacheManager.resetToDefault();
	}

	async selectCacheDirectory(_event: IpcMainInvokeEvent): Promise<string | null> {
		const result = await dialog.showOpenDialog({
			properties: ["openDirectory", "createDirectory"],
			title: "Select Cache Directory",
			buttonLabel: "Select",
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		return result.filePaths[0];
	}
}

export const generalSettingsService = new GeneralSettingsService();
