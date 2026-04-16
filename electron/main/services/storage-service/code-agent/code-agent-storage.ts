import { createLogger } from "@shared/logger";
import {
	type CodeAgentConfigMetadata,
	type CodeAgentGlobalConfigs,
	type CodeAgentType,
	type CodingAgentClass,
} from "@shared/storage/code-agent";
import type { MigrationConfig } from "@shared/types";
import { prefixStorage } from "@shared/types";
import { isNull } from "es-toolkit";
import { StorageService } from "..";
import { createMigrate } from "../migration-utils";

const logger = createLogger("services");

class CodeAgentStorage extends StorageService<CodeAgentConfigMetadata> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	async removeCodeAgentState(threadId: string): Promise<void> {
		await Promise.all([
			this.removeItemInternal(`code-agent-config-state-${threadId}`),
			this.removeItemInternal(`claude-code-agent-state-${threadId}`),
		]);
	}

	async getCodeAgentConfig(
		threadId: string,
	): Promise<{ isOK: boolean; data: CodeAgentConfigMetadata }> {
		const data = await this.getItemInternal(`code-agent-config-state-${threadId}`);
		if (isNull(data)) return { isOK: false, data: {} as CodeAgentConfigMetadata };
		return { isOK: true, data };
	}
}

export const codeAgentStorage = new CodeAgentStorage();

/* eslint-disable @typescript-eslint/no-explicit-any */
const migrations = {
	0: (state: any): CodeAgentGlobalConfigs => {
		// Migration from version 0 to 1:
		// Migrate telegram from { botToken, allowFrom } to { accounts: { default: { botToken } } }
		const oldTelegram = state?.telegram;
		const botToken = oldTelegram?.botToken ?? "";
		return {
			...state,
			telegram: {
				accounts: {
					default: {
						botToken,
					},
				},
			},
		};
	},
};

const globalConfigsMigrationConfig: MigrationConfig<CodeAgentGlobalConfigs> = {
	version: 1,
	migrate: createMigrate(migrations),
	debug: true,
};

class CodeAgentGlobalConfigsStorage extends StorageService<CodeAgentGlobalConfigs> {
	constructor() {
		super(globalConfigsMigrationConfig);
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
		this.migrationKey = "code-agent-global-configs";
	}

	async getGlobalConfigs(): Promise<{ isOK: boolean; data: CodeAgentGlobalConfigs }> {
		const defaultData = {
			apiKey: "",
			autoDeploy: true,
			autoFixDeployFailure: true,
			notificationsEnabled: false,
			lastVibeMode: "remote" as CodeAgentType,
			lastAgentId: "claude-code" as CodingAgentClass,
			feishu: {
				appId: "",
				appSecret: "",
			},
			dingtalk: {
				clientId: "",
				clientSecret: "",
			},
			qqbot: {
				appId: "",
				clientSecret: "",
			},
			wecom: {
				botId: "",
				secret: "",
			},
			telegram: {
				accounts: {
					default: {
						botToken: "",
					},
				},
			},
			discord: {
				token: "",
			},
		};
		try {
			const data = await this.getItemInternal("code-agent-global-configs");
			if (isNull(data)) return { isOK: false, data: defaultData };
			return { isOK: true, data };
		} catch (error) {
			logger.error("Error getting global configs:", error);
			return { isOK: false, data: defaultData };
		}
	}

	async setLastVibeMode(mode: CodeAgentType): Promise<{ isOK: boolean }> {
		try {
			const { data: currentData } = await this.getGlobalConfigs();
			const updatedData = { ...currentData, lastVibeMode: mode };
			await this.setItemInternal("code-agent-global-configs", updatedData);
			return { isOK: true };
		} catch (error) {
			logger.error("Error setting lastVibeMode:", error);
			return { isOK: false };
		}
	}
}

export const codeAgentGlobalConfigsStorage = new CodeAgentGlobalConfigsStorage();
