import { getSandboxHealthStatus, listInstances } from "@electron/main/apis/cloud-mode";
import {
	cloudModeStorage,
	getDefaultInstanceInfo,
} from "@electron/main/services/storage-service/cloud-mode/cloud-mode-storage";
import { createLogger } from "@shared/logger";
import type { InstanceInfo, SandboxHealthResponse } from "@shared/storage/cloud-mode";
import type { IpcMainInvokeEvent } from "electron";
import { attemptAsync, isNull } from "es-toolkit";
import { broadcastService } from "../broadcast-service";
import { schedulerService } from "../scheduler-service";

const logger = createLogger("services");

export class CloudModeService {
	/** Health status memory cache. The rendering process can directly query it through IPC. */
	#healthCache: SandboxHealthResponse | null = null;

	constructor() {
		// Sync once on startup (failure falls back to local cache)
		this.syncCloudInstanceToLocal()
			.then(() => this.maybeStartPolling())
			.catch((err) => {
				logger.warn("[CloudModeService] Initial sync failed, using cached data", err);
			});
	}

	/**
	 * Check if local instance exists, decide whether to start polling
	 */
	private async maybeStartPolling(): Promise<void> {
		const [error, instance] = await attemptAsync(() => cloudModeStorage.getCloudModeInstance());

		if (error || isNull(instance)) {
			logger.debug("[CloudModeService] No instance found, polling not started");
			return;
		}

		// Start polling if instance name exists (even if expired, need to monitor state changes)
		if (instance.instanceName) {
			this.startPolling();
			logger.info("[CloudModeService] Polling started for instance:", instance.instanceName);
		}
	}

	/**
	 * Start two scheduled tasks (addTask has internal deduplication, no need to worry about duplicate calls)
	 */
	private startPolling(): void {
		// Sync instance info every 5 minutes
		schedulerService.addTask("cloud-mode-instance-sync", "0 */5 * * * *", async () => {
			await this.syncCloudInstanceToLocal();
			// Check if polling should stop after sync
			await this.checkAndStopPolling();
		});

		// Health check every 30 seconds
		schedulerService.addTask("cloud-mode-health-polling", "*/30 * * * * *", async () => {
			await this.fetchAndBroadcastHealth();
		});
	}

	/**
	 * Stop polling (called when instance is destroyed)
	 */
	private stopPolling(): void {
		schedulerService.removeTask("cloud-mode-instance-sync");
		schedulerService.removeTask("cloud-mode-health-polling");
		this.#healthCache = null;
		logger.info("[CloudModeService] Polling stopped");
	}

	/**
	 * Check if instance has been destroyed, stop polling if so
	 */
	private async checkAndStopPolling(): Promise<void> {
		const [error, instance] = await attemptAsync(() => cloudModeStorage.getCloudModeInstance());

		if (error || isNull(instance) || !instance.instanceName) {
			this.stopPolling();
		}
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

		const [healthError, healthData] = await attemptAsync(() =>
			getSandboxHealthStatus(instance.publicIp, instance.apiPort),
		);

		if (healthError || isNull(healthData)) {
			this.#healthCache = null;
			broadcastService.broadcastChannelToAll("cloud-mode:timed", null);
			return;
		}

		this.#healthCache = healthData;
		broadcastService.broadcastChannelToAll("cloud-mode:timed", healthData);
	}

	/**
	 * Sync cloud instances to local storage
	 */
	private async syncCloudInstanceToLocal(): Promise<InstanceInfo[]> {
		logger.debug("[CloudModeService] Syncing cloud instances to local storage...");

		const [error, response] = await attemptAsync(() => listInstances());

		if (error || !response?.success) {
			logger.error("[CloudModeService] Error during cloud instance sync:", error, response);
			throw error || new Error("Request was unsuccessful. Keeping existing local data.");
		}

		if (response.instances.length > 0) {
			const activeInstance = response.instances[0];
			await cloudModeStorage.setCloudModeInstance(activeInstance);
			logger.info(
				"[CloudModeService] Found active cloud instance:",
				activeInstance.instanceName,
			);
		} else {
			// No instances in cloud, clear local data
			await cloudModeStorage.setCloudModeInstance(getDefaultInstanceInfo());
			logger.info("[CloudModeService] No cloud instances found, clearing local data");
		}

		return response.instances;
	}

	public async syncCloudInstanceToLocalByIpc(
		_event: IpcMainInvokeEvent,
	): Promise<{ isOk: boolean; data: InstanceInfo[] }> {
		const [error, data] = await attemptAsync(() => this.syncCloudInstanceToLocal());

		if (error || !data) {
			logger.error("[CloudModeService] Error during cloud instance sync by IPC:", error);
			return { isOk: false, data: [] };
		}

		return { isOk: true, data };
	}

	/**
	 * IPC: Sync + Start polling (called by renderer after instance operations)
	 */
	public async syncAndStartPollingByIpc(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		const [syncError] = await attemptAsync(() => this.syncCloudInstanceToLocal());

		if (syncError) {
			logger.error("[CloudModeService] syncAndStartPollingByIpc failed:", syncError);
			return { isOk: false };
		}

		await this.maybeStartPolling();
		return { isOk: true };
	}

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
