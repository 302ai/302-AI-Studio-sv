import type { Model } from "@302ai/studio-plugin-sdk";
import type { SessionMetadata } from "@shared/storage/session";
import { prefixStorage } from "@shared/types";
import { isNull } from "es-toolkit";
import { StorageService } from ".";

class SessionStorage extends StorageService<SessionMetadata> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "SessionStorage");
	}

	async getLatestUsedModel(): Promise<Model | null> {
		try {
			const data = await this.getItemInternal("session-metadata");
			if (isNull(data)) return null;
			return data.latestUsedModel;
		} catch (error) {
			console.error("Failed to get latest model ID:", error);
			return null;
		}
	}
}

export const sessionStorage = new SessionStorage();
