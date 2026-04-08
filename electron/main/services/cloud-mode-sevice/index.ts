import { listInstances } from "@electron/main/apis/cloud-mode";
import { cloudModeStorage } from "@electron/main/services/storage-service/cloud-mode/cloud-mode-storage";
import { createLogger } from "@shared/logger";

const logger = createLogger("services");

/**
 * CloudMode Service
 * Handles business logic related to cloud mode management.
 */
export class CloudModeService {
	constructor() {
		// Automatically sync cloud instances to local storage on service initialization
		this.syncCloudInstanceToLocal().catch((error) => {
			logger.error("[CloudModeService] Failed to sync cloud instance on init:", error);
		});
	}

	/**
	 * Synchronizes the remote cloud instance list to local persistent storage.
	 * If instances exist on the cloud, the first one is used as the active instance locally.
	 * If no instances exist or the request fails, the local storage remains unchanged.
	 */
	public async syncCloudInstanceToLocal(): Promise<void> {
		try {
			logger.info("[CloudModeService] Syncing cloud instances to local storage...");
			const response = await listInstances();

			if (response.success && response.instances.length > 0) {
				const activeInstance = response.instances[0];
				logger.info(
					"[CloudModeService] Found active cloud instance, updating local storage:",
					activeInstance.instanceName,
				);
				await cloudModeStorage.setCloudModeInstance(activeInstance);
			} else {
				// We do NOT reset local data if the remote list is empty or the request failed
				// This preserves local data for offline use or intermittent API issues
				logger.info(
					"[CloudModeService] No cloud instances found or request was unsuccessful. Keeping existing local data.",
				);
			}
		} catch (error) {
			logger.error("[CloudModeService] Error during cloud instance sync:", error);
			// Do not re-throw to prevent initialization crashes, existing local data is preserved
		}
	}
}

export const cloudModeService = new CloudModeService();
