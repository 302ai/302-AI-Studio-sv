import { getSandboxHealthStatus, listInstances } from "@electron/main/apis/cloud-mode";
import {
	cloudModeStorage,
	getDefaultInstanceInfo,
} from "@electron/main/services/storage-service/cloud-mode/cloud-mode-storage";
import { createLogger } from "@shared/logger";
import type { InstanceInfo, SandboxHealthResponse } from "@shared/storage/cloud-mode";
import type { IpcMainInvokeEvent } from "electron";
import { attemptAsync, isNull } from "es-toolkit";
import { broadcastService, emitter } from "../broadcast-service";
import { CRON_EXPRESSION, schedulerService } from "../scheduler-service";

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

		// Listen to API key changes
		emitter.on("provider:302ai-provider-changed", ({ apiKey }) => {
			this.handle302AIProviderChange(apiKey);
		});
	}

	/**
	 * Check if local instance exists, decide whether to start polling
	 */
	private async maybeStartPolling(mode?: "fast" | "normal"): Promise<void> {
		const [error, instance] = await attemptAsync(() => cloudModeStorage.getCloudModeInstance());

		if (error || isNull(instance)) {
			logger.info("[CloudModeService] No instance found, polling not started");
			return;
		}
		const resolvedMode = mode || (instance.status !== "running" ? "fast" : "normal");
		// Start polling if instance name exists (even if expired, need to monitor state changes)
		if (instance.instanceName) {
			logger.info("[CloudModeService] Polling started for instance:", instance.instanceName);
		} else {
			logger.info("[CloudModeService] No instance name found, polling not started");
		}

		this.startPolling(resolvedMode);
	}

	/**
	 * Start two scheduled tasks (addTask has internal deduplication, no need to worry about duplicate calls)
	 */
	private startPolling(mode: "fast" | "normal" = "normal"): void {
		// Sync instance info: 20s if fast, 5m if normal
		const instanceSyncCron =
			mode === "fast" ? CRON_EXPRESSION.EVERY_20_SECONDS : CRON_EXPRESSION.EVERY_5_MINUTES;

		schedulerService.addTask("cloud-mode-instance-sync", instanceSyncCron, async () => {
			logger.info("[CloudModeService] Starting instance sync");
			const [error, instances] = await attemptAsync(() => this.syncCloudInstanceToLocal());

			// If we are in fast polling mode and the instance reached "running", revert to normal 5m polling
			if (mode === "fast" && !error && instances && instances.length > 0) {
				if (instances[0].status === "running") {
					logger.info(
						"[CloudModeService] Instance is running. Reverting to normal polling.",
					);
					this.startPolling("normal");
				}
			}

			// Check if polling should stop after sync
			await this.checkAndStopPolling();
		});

		// Health check every 30 seconds
		schedulerService.addTask(
			"cloud-mode-health-polling",
			CRON_EXPRESSION.EVERY_15_SECONDS,
			async () => {
				logger.info("[CloudModeService] Starting health poll");
				await this.fetchAndBroadcastHealth();
			},
		);
	}

	async overrideCloudModeHealthPolling(
		_event: IpcMainInvokeEvent,
		mode: "fast" | "normal" = "normal",
	) {
		const healthPollingCron =
			mode === "fast" ? CRON_EXPRESSION.EVERY_10_SECONDS : CRON_EXPRESSION.EVERY_30_SECONDS;

		schedulerService.addTask("cloud-mode-health-polling", healthPollingCron, async () => {
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
	 * Handle 302.AI provider API key change
	 * Reset polling to sync latest instance state with new key
	 */
	private async handle302AIProviderChange(apiKey: string): Promise<void> {
		logger.info("[CloudModeService] API key changed, resetting cloud mode polling");

		// Stop existing polling to prevent race conditions
		this.stopPolling();

		// Clear health cache (old key's data is invalid)
		this.#healthCache = null;

		// Re-sync instance list with new key
		const [error] = await attemptAsync(() => this.syncCloudInstanceToLocal(apiKey));

		if (error) {
			logger.error(
				"[CloudModeService] Failed to sync instances after API key change:",
				error,
			);
			// Clear local storage since old key's data is invalid
			await cloudModeStorage.setCloudModeInstance(getDefaultInstanceInfo());
			// Broadcast null to clear stale UI state
			broadcastService.broadcastChannelToAll("cloud-mode:timed", null);
			return;
		}

		// Restart polling if instance exists
		await this.maybeStartPolling();
		logger.info("[CloudModeService] Cloud mode polling restarted with new API key");
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
			logger.error("[CloudModeService] Failed to get cloud mode instance:", storageError);
			broadcastService.broadcastChannelToAll("cloud-mode:timed", null);
			return;
		}

		if (!instance.publicIp || !instance.apiPort || instance.expired) {
			this.#healthCache = null;
			logger.error("[CloudModeService] Instance is invalid or expired");
			broadcastService.broadcastChannelToAll("cloud-mode:timed", null);
			return;
		}

		const [healthError, healthData] = await attemptAsync(() =>
			getSandboxHealthStatus(instance.publicIp, instance.apiPort),
		);

		if (healthError || isNull(healthData)) {
			this.#healthCache = null;
			logger.error("[CloudModeService] Failed to get cloud sandbox health:", healthError);
			broadcastService.broadcastChannelToAll("cloud-mode:timed", null);
			return;
		}

		this.#healthCache = healthData;
		logger.info("[CloudModeService] Health data updated:", healthData);
		broadcastService.broadcastChannelToAll("cloud-mode:timed", healthData);
	}

	/**
	 * Sync cloud instances to local storage
	 * @param apiKey - Optional API key to use instead of the stored one
	 */
	private async syncCloudInstanceToLocal(apiKey?: string): Promise<InstanceInfo[]> {
		logger.info("[CloudModeService] Syncing cloud instances to local storage...");

		const [error, response] = await attemptAsync(() => listInstances(apiKey));

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
	): Promise<{ isOk: boolean; data: InstanceInfo[]; error?: { code: string; message: string } }> {
		const [error, data] = await attemptAsync(() => this.syncCloudInstanceToLocal());

		if (error || !data) {
			logger.error("[CloudModeService] Error during cloud instance sync by IPC:", error);
			const errorInfo =
				error instanceof Error
					? // eslint-disable-next-line @typescript-eslint/no-explicit-any
						{ code: (error as any).code ?? "UNKNOWN_ERROR", message: error.message }
					: undefined;
			return { isOk: false, data: [], error: errorInfo };
		}

		return { isOk: true, data };
	}

	/**
	 * IPC: Sync + Start polling (called by renderer after instance operations)
	 */
	public async syncAndStartPollingByIpc(_event: IpcMainInvokeEvent): Promise<{ isOk: boolean }> {
		// Do a normal sync first (can show errors if it fails immediately after operation)
		const [syncError] = await attemptAsync(() => this.syncCloudInstanceToLocal());

		if (syncError) {
			logger.error("[CloudModeService] syncAndStartPollingByIpc failed:", syncError);
			return { isOk: false };
		}

		// Start fast polling
		await this.maybeStartPolling("fast");
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
