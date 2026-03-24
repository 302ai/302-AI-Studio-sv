import type { OpenClawConfig } from "@shared/storage/openclaw";
import { prefixStorage } from "@shared/types";
import { StorageService } from "..";

class OpenClawConfigStorage extends StorageService<OpenClawConfig> {
	private prefix = "openclaw-config-state";

	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "OpenClawStorage");
	}

	async getOpenClawConfig(threadId: string): Promise<{ isOK: boolean; data: OpenClawConfig }> {
		try {
			const data = await this.getItemInternal(this.prefix + "-" + threadId);
			if (!data)
				return { isOK: false, data: { feishuSessionId: "", agentId: "", telegramBotId: "" } };
			return { isOK: true, data };
		} catch (error) {
			console.error("Error getting openclaw config:", error);
			return { isOK: false, data: { feishuSessionId: "", agentId: "", telegramBotId: "" } };
		}
	}
}

export const openClawConfigStorage = new OpenClawConfigStorage();
