import { PLATFORM } from "@electron/main/constants";
import { type LocalVibeStorageData } from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
import { isNull } from "es-toolkit";
import { StorageService } from "..";

const STORAGE_KEY = "local-vibe-data";

const DEFAULT_DATA: LocalVibeStorageData = {
	// Linux runs Podman in rootless mode with no VM, so machine config does not apply
	needUpdateVmConfig: !PLATFORM.IS_LINUX,
	needUpdateWslConf: PLATFORM.IS_WINDOWS,
	openclawJsonTemplateVersion: 0,
};

class LocalVibeStorage extends StorageService<LocalVibeStorageData> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "LocalVibeStorage");
	}

	async initData() {
		const { data: current, isOK } = await this.getData();
		if (isOK) {
			// update version
			console.log("update leessmin");
			if (current.openclawJsonTemplateVersion != DEFAULT_DATA.openclawJsonTemplateVersion) {
				this.setData({
					openclawJsonTemplateVersion: DEFAULT_DATA.openclawJsonTemplateVersion,
				});
			}
		}
		// init
		this.setData(current);
	}

	async getData(): Promise<{ isOK: boolean; data: LocalVibeStorageData }> {
		try {
			const data = await this.getItemInternal(STORAGE_KEY);
			if (isNull(data)) return { isOK: false, data: DEFAULT_DATA };
			return { isOK: true, data };
		} catch (error) {
			console.error("Error getting local vibe storage data:", error);
			return { isOK: false, data: DEFAULT_DATA };
		}
	}

	async setData(data: Partial<LocalVibeStorageData>): Promise<{ isOK: boolean }> {
		try {
			const { data: current } = await this.getData();
			await this.setItemInternal(STORAGE_KEY, { ...current, ...data });
			return { isOK: true };
		} catch (error) {
			console.error("Error setting local vibe storage data:", error);
			return { isOK: false };
		}
	}
}

export const localVibeStorage = new LocalVibeStorage();

localVibeStorage.initData();
