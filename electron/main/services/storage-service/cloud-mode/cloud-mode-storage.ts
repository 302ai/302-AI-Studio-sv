import type { InstanceInfo } from "@shared/storage/cloud-mode";
import { prefixStorage } from "@shared/types";
import { isEqual } from "es-toolkit";
import { StorageService } from "..";

/**
 * Returns default instance info if no data exists in storage.
 */
const getDefaultInstanceInfo = (): InstanceInfo => ({
	instanceName: "",
	publicIp: "",
	createdAt: "",
	expiredAt: "",
	apiPort: 0,
	ocPort: 0,
	openclawGatewayToken: "",
});

/**
 * CloudMode Storage Service
 * Manages the persistence of cloud mode instance information.
 */
class CloudModeStorage extends StorageService<InstanceInfo> {
	private readonly STATE_KEY = "state";

	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CloudModeStorage");
	}

	/**
	 * Retrieves the stored cloud mode instance information.
	 * Returns default instance info if no data exists in storage.
	 */
	async getCloudModeInstance(): Promise<InstanceInfo> {
		const info = await this.getItemInternal(this.STATE_KEY);
		return info ?? getDefaultInstanceInfo();
	}

	/**
	 * Persists the cloud mode instance information.
	 * Uses es-toolkit's isEqual to prevent redundant disk writes if the content hasn't changed.
	 */
	async setCloudModeInstance(info: InstanceInfo): Promise<void> {
		const current = await this.getCloudModeInstance();

		// Perform idempotent write by comparing content to optimize IO performance
		if (isEqual(current, info)) return;

		await this.setItemInternal(this.STATE_KEY, info);
	}
}

export const cloudModeStorage = new CloudModeStorage();
