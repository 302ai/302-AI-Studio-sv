import { type IpcMainInvokeEvent } from "electron";
import fs from "fs/promises";
import { get, set } from "es-toolkit/compat";
import { localVibeService } from "../local-vibe-service";

export class OpenClawService {
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
		const port = localVibeService.getRuntimeOpenClawPort();
		if (!port) return null;

		const gatewayToken = await this.getOpenClawConfig<string>("gateway.auth.token");

		return `http://localhost:${port}/?token=${gatewayToken || ""}`;
	}
}

export const openClawService = new OpenClawService();
