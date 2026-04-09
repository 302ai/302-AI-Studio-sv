import { listInstances } from "@electron/main/apis/cloud-mode";
import { cloudModeStorage } from "@electron/main/services/storage-service/cloud-mode/cloud-mode-storage";
import { createLogger } from "@shared/logger";
import type { IpcMainInvokeEvent } from "electron";
import { attemptAsync, isNull } from "es-toolkit";
import { broadcastService } from "../broadcast-service";
import { CRON_EXPRESSION, schedulerService } from "../scheduler-service";

const logger = createLogger("services");

export class CloudModeService {
	constructor() {
		schedulerService.addTask(CloudModeService.schedulerName, "0 5 0 * * *", async () => {
			logger.info(
				"[CloudModeService] Running scheduled task to sync cloud instances and broadcast...",
			);
			// 广播
			this.syncCloudInstanceToLocal();
		});
	}

	private async syncCloudInstanceToLocal(): Promise<void> {
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
				logger.info(
					"[CloudModeService] No cloud instances found or request was unsuccessful. Keeping existing local data.",
				);
			}
		} catch (error) {
			logger.error("[CloudModeService] Error during cloud instance sync:", error);
		}
	}

	public async syncCloudInstanceToLocalByIpc(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean }> {
		try {
			await this.syncCloudInstanceToLocal();
			return { isOk: true };
		} catch (error) {
			logger.error("[CloudModeService] Error during cloud instance sync:", error);
			return { isOk: false };
		}
	}

	public async getCloudModeInstanceBaseUrl(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean; baseUrl: string }> {
		const [error, instance] = await attemptAsync(() => cloudModeStorage.getCloudModeInstance());

		if (error || isNull(instance)) {
			logger.error("[CloudModeService] Error getting cloud mode instance:", error);
			return { isOk: false, baseUrl: "" };
		}

		return { isOk: true, baseUrl: `http://${instance.publicIp}:${instance.apiPort}` };
	}

	static schedulerName = "cloud-mode-timed-broadcaster";

	public async registerBroadcasterTimed(_event: IpcMainInvokeEvent) {
		schedulerService.addTask(
			CloudModeService.schedulerName,
			CRON_EXPRESSION.EVERY_60_SECONDS,
			async () => {
				// 广播
				broadcastService.broadcastChannelToAll("cloud-mode:timed");
			},
		);
	}

	public async unregisterBroadcasterTimed(_event: IpcMainInvokeEvent) {
		schedulerService.removeTask(CloudModeService.schedulerName);
	}
}

export const cloudModeService = new CloudModeService();
