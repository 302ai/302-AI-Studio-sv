import {
	type CodeAgentConfigMetadata,
	type CodeAgentGlobalConfigs,
	type CodeAgentType,
} from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
import { isNull } from "es-toolkit";
import { StorageService } from "..";

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

class CodeAgentGlobalConfigsStorage extends StorageService<CodeAgentGlobalConfigs> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	async getGlobalConfigs(): Promise<{ isOK: boolean; data: CodeAgentGlobalConfigs }> {
		const defaultData = {
			apiKey: "",
			autoDeploy: true,
			notificationsEnabled: false,
			lastVibeMode: "remote" as const,
			openClawConfig: {
				"fei-shu": {
					appId: "",
					appSecret: "",
				},
			},
		};
		try {
			const data = await this.getItemInternal("code-agent-global-configs");
			if (isNull(data)) return { isOK: false, data: defaultData };
			return { isOK: true, data };
		} catch (error) {
			console.error("Error getting global configs:", error);
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
			console.error("Error setting lastVibeMode:", error);
			return { isOK: false };
		}
	}
}

export const codeAgentGlobalConfigsStorage = new CodeAgentGlobalConfigsStorage();
