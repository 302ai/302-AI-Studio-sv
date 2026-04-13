import { getSandboxHealthStatus, listInstances } from "@electron/main/apis/cloud-mode";
import { cloudModeStorage } from "@electron/main/services/storage-service/cloud-mode/cloud-mode-storage";
import { createLogger } from "@shared/logger";
import type { SandboxHealthResponse } from "@shared/storage/cloud-mode";
import type { IpcMainInvokeEvent } from "electron";
import { attemptAsync, isNull } from "es-toolkit";
import { broadcastService } from "../broadcast-service";
import { CRON_EXPRESSION, schedulerService } from "../scheduler-service";

const logger = createLogger("services");

export class CloudModeService {
	/** Health status memory cache. The rendering process can directly query it through IPC. */
	#healthCache: SandboxHealthResponse | null = null;

	constructor() {
		// Sync instance information daily to local storage
		schedulerService.addTask("cloud-mode-daily-sync", "0 5 0 * * *", async () => {
			logger.info("[CloudModeService] Running daily sync task...");
			this.syncCloudInstanceToLocal();
		});

		// 60-second health check (managed uniformly by the main process, no need for the rendering process to register)
		schedulerService.addTask(
			"cloud-mode-health-polling",
			CRON_EXPRESSION.EVERY_60_SECONDS,
			async () => {
				await this.fetchAndBroadcastHealth();
			},
		);

		// Perform a health check immediately upon startup
		this.fetchAndBroadcastHealth();
	}

	/**
	 * Unified health check logic: Request → Update cache → Broadcast to all rendering processes
	 */
	private async fetchAndBroadcastHealth(): Promise<void> {
		const [storageError, instance] = await attemptAsync(() =>
			cloudModeStorage.getCloudModeInstance(),
		);

		if (storageError || isNull(instance)) {
			this.#healthCache = null;
			broadcastService.broadcastChannelToAll("cloud-mode:timed", null);
			return;
		}

		if (!instance.publicIp || !instance.apiPort || instance.expired) {
			this.#healthCache = null;
			broadcastService.broadcastChannelToAll("cloud-mode:timed", null);
			return;
		}

		try {
			const healthData = await getSandboxHealthStatus(instance.publicIp, instance.apiPort);
			this.#healthCache = healthData;
			broadcastService.broadcastChannelToAll("cloud-mode:timed", healthData);
		} catch {
			this.#healthCache = null;
			broadcastService.broadcastChannelToAll("cloud-mode:timed", null);
		}
	}

	// ── Instance synchronization ──────────────────────────────────────────────

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

	// ── Example URL ──────────────────────────────────────────────

	public async getCloudModeInstanceBaseUrl(): Promise<{ isOk: boolean; baseUrl: string }> {
		const [error, instance] = await attemptAsync(() => cloudModeStorage.getCloudModeInstance());

		if (error || isNull(instance)) {
			logger.error("[CloudModeService] Error getting cloud mode instance:", error);
			return { isOk: false, baseUrl: "" };
		}

		return { isOk: true, baseUrl: `http://${instance.publicIp}:${instance.apiPort}` };
	}

	public async getCloudModeInstanceBaseUrlByIpc(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean; baseUrl: string }> {
		return this.getCloudModeInstanceBaseUrl();
	}

	// ── Health status IPC ──────────────────────────────────────────

	/**
	 * Query the health status of the rendering process cache (without initiating new requests)
	 */
	public async getHealthStatusByIpc(
		_event: IpcMainInvokeEvent,
	): Promise<SandboxHealthResponse | null> {
		return this.#healthCache;
	}

	/**
	 * The rendering process initiates a health check actively (for scenarios such as restarting containers)
	 * After the request is completed, the cache is updated and broadcast to all tabs
	 */
	public async refreshHealthByIpc(
		_event: IpcMainInvokeEvent,
	): Promise<SandboxHealthResponse | null> {
		await this.fetchAndBroadcastHealth();
		return this.#healthCache;
	}
}

export const cloudModeService = new CloudModeService();
