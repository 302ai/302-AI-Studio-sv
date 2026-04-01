import type { OpenClawConfig } from "@shared/storage/openclaw";
import { createLogger } from "@shared/logger";

const logger = createLogger("storage");
import { prefixStorage } from "@shared/types";
import { StorageService } from "..";

const DEFAULT_OPENCLAW_CONFIG: OpenClawConfig = {
	feishuSessionId: "",
	agentId: "",
	telegramBotId: "",
};

class OpenClawConfigStorage extends StorageService<OpenClawConfig> {
	private prefix = "openclaw-config-state";

	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "OpenClawStorage");
	}

	async getOpenClawConfig(threadId: string): Promise<{ isOK: boolean; data: OpenClawConfig }> {
		try {
			const data = await this.getItemInternal(this.prefix + "-" + threadId);
			if (!data) return { isOK: false, data: DEFAULT_OPENCLAW_CONFIG };
			return { isOK: true, data };
		} catch (error) {
			logger.error("Error getting openclaw config:", error);
			return { isOK: false, data: DEFAULT_OPENCLAW_CONFIG };
		}
	}
}

export const openClawConfigStorage = new OpenClawConfigStorage();
