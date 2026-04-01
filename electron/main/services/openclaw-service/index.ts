import { isWin } from "@electron/main/constants";
import { createLogger } from "@shared/logger";

const logger = createLogger("app");
import { SUPPORTED_CHANNELS, WIN_SUPPORTED_CHANNELS } from "@shared/storage/code-agent";
import { type IpcMainInvokeEvent } from "electron";
import { isNil } from "es-toolkit";
import { get, isUndefined, merge, pick, set } from "es-toolkit/compat";
import fs from "fs/promises";
import { getOpenClawConfigPath, getRuntimeComposeDir } from "../../utils/local-vibe-utils";
import { localVibeService } from "../local-vibe-service";
import { codeAgentGlobalConfigsStorage } from "../storage-service/code-agent";
import { openClawConfigStorage } from "../storage-service/openclaw/openclaw-config-storage";
import { tabService } from "../tab-service";
import WeChatChannel from "./wechat";

type OpenClawBindingConfig = {
	agentId: string;
	match: {
		channel: string;
		accountId?: string;
		peer?: {
			kind: string;
			id: string;
		};
	};
};

type OpenClawAccountsConfig = {
	enabled: boolean;
	dmPolicy: string;
	botToken: string;
	groupPolicy: string;
};

export class OpenClawService {
	private async _getOpenClawWebUiUrl(): Promise<string | null> {
		const port = localVibeService.getRuntimeOpenClawPort();
		if (!port) return null;

		const gatewayToken = await this.getOpenClawConfig<string>("gateway.auth.token");
		const url = `http://localhost:${port}/#token=${gatewayToken || ""}`;
		logger.info("WebUI URL:", url);

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
		const configPath = getOpenClawConfigPath(getRuntimeComposeDir());

		try {
			const configContent = await fs.readFile(configPath, "utf-8");
			const config = JSON.parse(configContent);

			if (!path) {
				return config as T;
			}

			return get(config, path) ?? null;
		} catch (error) {
			logger.error("Failed to read or parse openclaw.json:", error);
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
		const configPath = getOpenClawConfigPath(getRuntimeComposeDir());

		try {
			const config = await this.getOpenClawConfig<Record<string, unknown>>();
			if (!config) {
				logger.error("Failed to read existing config");
				return false;
			}

			set(config, path, value);

			await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
			return true;
		} catch (error) {
			logger.error("Failed to write openclaw.json:", error);
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

		const filteredData = pick(configs.data, isWin ? WIN_SUPPORTED_CHANNELS : SUPPORTED_CHANNELS);

		await this.setOpenClawConfig("channels", merge(channels, filteredData));
	}

	/**
	 * Apply channel bindings configurations to OpenClaw
	 * @param _event Electron IPC event
	 * @param threadId Thread ID to apply bindings for
	 * @returns
	 */
	async applyOpenClawBindingsConfig(_event: IpcMainInvokeEvent, threadId: string) {
		const config = await openClawConfigStorage.getOpenClawConfig(threadId);
		if (!config.isOK) {
			logger.error("Failed to get thread config:", threadId);
			return;
		}

		const { agentId, feishuSessionId, telegramBotId } = config.data;
		const desiredBindings: OpenClawBindingConfig[] = [];

		if (feishuSessionId) {
			desiredBindings.push({
				agentId,
				match: {
					channel: "feishu",
					peer: {
						kind: "group",
						id: feishuSessionId,
					},
				},
			});
		}

		if (telegramBotId) {
			await this.getOpenClawConfig("bindings");
			const accountId = `${agentId}_302ai`;
			desiredBindings.push({
				agentId,
				match: {
					channel: "telegram",
					accountId: accountId,
				},
			});

			// Deal channels.telegram.accounts.`any`
			{
				const tmpAccount = {
					enabled: true,
					dmPolicy: "open",
					botToken: telegramBotId,
					groupPolicy: "open",
				};
				const tgAccounts: {
					default: OpenClawAccountsConfig;
					[key: string]: OpenClawAccountsConfig;
				} = (await this.getOpenClawConfig("channels.telegram.accounts")) || {
					default: tmpAccount,
				};
				for (const key in tgAccounts) {
					// key == "default" You can't delete it !!!!!!!!!!!!!!
					if (key != accountId && tgAccounts[key].botToken == telegramBotId && key != "default") {
						delete tgAccounts[key];
					}
				}
				tgAccounts[accountId] = tmpAccount;
				await this.setOpenClawConfig("channels.telegram.accounts", tgAccounts);
			}
		}

		const bindings: OpenClawBindingConfig[] = (await this.getOpenClawConfig("bindings")) ?? [];

		const nextBindings = bindings.reduce<OpenClawBindingConfig[]>((acc, b) => {
			// 1. Remove all old bindings for this agent
			if (b.agentId === agentId) return acc;

			// 2. Resolve conflicts: remove bindings from other agents occupying the exact same channel/peer
			const isConflict = desiredBindings.some(
				(d) => d.match.channel === b.match.channel && d.match.peer?.id === b.match.peer?.id,
			);
			if (isConflict) return acc;

			// Keep other valid bindings
			acc.push(b);
			return acc;
		}, []);

		// 3. Append the new desired bindings
		nextBindings.push(...desiredBindings);

		await this.setOpenClawConfig("bindings", nextBindings);
	}

	async handleOpenClawWebUiReloadIpc(_event: IpcMainInvokeEvent, tabId: string) {
		const tabView = tabService.getTabView(tabId);
		if (isUndefined(tabView)) return;
		const url = await this._getOpenClawWebUiUrl();
		logger.info("Reloading OpenClaw Web UI with URL:", url);
		if (!url) return;
		tabView.webContents.loadURL(url);
	}

	wechatChannel = new WeChatChannel();

	async wechatInsalled(_event: IpcMainInvokeEvent) {
		const config = await this.getOpenClawConfig("plugins.installs.openclaw-weixin");
		return !isNil(config);
	}

	async connectWechat(_event: IpcMainInvokeEvent) {
		const installed = await this.wechatInsalled(_event);
		await this.wechatChannel.startWeixinLoginFlow(installed);
	}

	async disposeWechat(_event: IpcMainInvokeEvent) {
		await this.wechatChannel.dispose();
	}
}

export const openClawService = new OpenClawService();
