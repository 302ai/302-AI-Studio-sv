import { AiApplication, prefixStorage } from "@shared/types";
import { StorageService } from ".";

export class AiApplicationStorage extends StorageService<AiApplication[]> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "AiApplicationsStorage");
	}

	async setAiApplications(aiApplications: AiApplication[]) {
		await this.setItemInternal("state", aiApplications);
	}

	async getAiApplications(): Promise<AiApplication[]> {
		return (await this.getItemInternal("state")) ?? [];
	}
}

export const aiApplicationStorage = new AiApplicationStorage();
