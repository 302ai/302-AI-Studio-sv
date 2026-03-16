import { SUPPORTED_CHANNELS } from "@shared/storage/code-agent";
import { type IpcMainInvokeEvent } from "electron";
import { get, isUndefined, merge, pick, set } from "es-toolkit/compat";
import fs from "fs/promises";
import { localVibeService } from "../local-vibe-service";
import { codeAgentGlobalConfigsStorage } from "../storage-service/code-agent";
import { tabService } from "../tab-service";

export class OpenClawService {
	private async _getOpenClawWebUiUrl(): Promise<string | null> {
		const port = localVibeService.getRuntimeOpenClawPort();
		if (!port) return null;

		const gatewayToken = await this.getOpenClawConfig<string>("gateway.auth.token");
		const url = `http://localhost:${port}/?token=${gatewayToken || ""}`;
		console.log("[OpenClawService] WebUI URL:", url);

		return url;
	}

	/**
	 * Get OpenClaw configuration from config file
	 * @param path - Optional dot-notation path to a specific config property (e.g., "gateway.auth.token")
	 * @returns The config value at the path, the entire config object, or null if failed to read/parse
	 * @example
	 * // Read entire config
	 * const config = await this.getOpenClawConfig();
	 *
	 * // Read specific value with path
	 * const token = await this.getOpenClawConfig("gateway.auth.token");
	 * const port = await this.getOpenClawConfig("gateway.port");
	 * const models = await this.getOpenClawConfig("models.providers.ai302.models");
	 */
	private async getOpenClawConfig<T = unknown>(path?: string): Promise<T | null> {
		const configPath = localVibeService.getOpenClawConfigPath();

		try {
			const configContent = await fs.readFile(configPath, "utf-8");
			const config = JSON.parse(configContent);

			if (!path) {
				return config as T;
			}

			return get(config, path) ?? null;
		} catch (error) {
			console.error("[OpenClawService] Failed to read or parse openclaw.json:", error);
			return null;
		}
	}

	/**
	 * Set a value in OpenClaw configuration at a specific path
	 * @param path - Dot-notation path to the config property (e.g., "gateway.auth.token")
	 * @param value - The value to set
	 * @returns True if successful, false otherwise
	 */
	private async setOpenClawConfig<T>(path: string, value: T): Promise<boolean> {
		const configPath = localVibeService.getOpenClawConfigPath();

		try {
			const config = await this.getOpenClawConfig<Record<string, unknown>>();
			if (!config) {
				console.error("[OpenClawService] Failed to read existing config");
				return false;
			}

			set(config, path, value);

			await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
			return true;
		} catch (error) {
			console.error("[OpenClawService] Failed to write openclaw.json:", error);
			return false;
		}
	}

	async getOpenClawWebUiUrl(_event: IpcMainInvokeEvent) {
		return await this._getOpenClawWebUiUrl();
	}

	/**
	 * Apply channel configurations to OpenClaw
	 */
	async applyOpenClawChannelConfig(_event: IpcMainInvokeEvent) {
		const [configs, channels] = await Promise.all([
			codeAgentGlobalConfigsStorage.getGlobalConfigs(),
			this.getOpenClawConfig("channels"),
		]);

		const filteredData = pick(configs.data, SUPPORTED_CHANNELS);

		await this.setOpenClawConfig("channels", merge(channels, filteredData));
	}

	async handleOpenClawWebUiReloadIpc(_event: IpcMainInvokeEvent, tabId: string) {
		const tabView = tabService.getTabView(tabId);
		if (isUndefined(tabView)) return;
		const url = await this._getOpenClawWebUiUrl();
		console.log("[OpenClawService] Reloading OpenClaw Web UI with URL:", url);
		if (!url) return;
		tabView.webContents.loadURL(url);
	}
}

export const openClawService = new OpenClawService();
