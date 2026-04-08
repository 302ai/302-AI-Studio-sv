import {
	createInstance,
	getCloudSandboxHealth,
	getInstanceStatus,
	listInstances,
	rebootInstance,
	restartDocker,
} from "$lib/api/cloud-mode/base-apis";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { createLogger } from "@shared/logger";
import type { InstanceInfo } from "@shared/storage/cloud-mode";

const logger = createLogger("state");
const POLL_INTERVAL_MS = 30_000;

export type CloudHealthStatus = "unknown" | "healthy" | "unhealthy";

export const getDefaultInstanceInfo = (): InstanceInfo => ({
	instanceName: "",
	publicIp: "",
	createdAt: "",
	expiredAt: "",
	apiPort: 0,
	ocPort: 0,
	openclawGatewayToken: "",
});

export const persistedCloudModeState = new PersistedState<InstanceInfo>(
	"CloudModeStorage:state",
	getDefaultInstanceInfo(),
);

class CloudModeStateManager {
	activated = $state(false);
	running = $state(false);
	starting = $state(false);
	healthStatus = $state<CloudHealthStatus>("unknown");
	instanceStatus = $state<CloudHealthStatus>("unknown");
	openClawStatus = $state<CloudHealthStatus>("unknown");
	instanceInfo = $derived.by(() => {
		const info = persistedCloudModeState.current;
		return info.instanceName ? info : null;
	});
	checking = $state(false);

	instanceName = $derived(persistedCloudModeState.current?.instanceName ?? "");
	publicIp = $derived(persistedCloudModeState.current?.publicIp ?? "");
	createdAt = $derived(persistedCloudModeState.current?.createdAt ?? "");
	expiredAt = $derived(persistedCloudModeState.current?.expiredAt ?? "");
	apiPort = $derived(persistedCloudModeState.current?.apiPort ?? 0);
	ocPort = $derived(persistedCloudModeState.current?.ocPort ?? 0);
	openclawGatewayToken = $derived(persistedCloudModeState.current?.openclawGatewayToken ?? "");

	private pollingTimer: ReturnType<typeof setInterval> | null = null;
	private pollingSubscriberCount = 0;
	private ocStartupGraceUntil = 0;
	private readonly OC_STARTUP_GRACE_PERIOD_MS = 60_000;

	#updateState(partial: Partial<InstanceInfo>): void {
		logger.debug("[CloudModeStateManager] updateState", partial);
		persistedCloudModeState.current = {
			...(persistedCloudModeState.current ?? getDefaultInstanceInfo()),
			...partial,
		};
	}

	updateInstanceInfo(info: InstanceInfo): void {
		this.#updateState(info);
	}

	#resetRuntimeState(): void {
		this.stopPolling();
		this.pollingSubscriberCount = 0;
		this.activated = false;
		this.running = false;
		this.starting = false;
		this.healthStatus = "unknown";
		this.instanceStatus = "unknown";
		this.openClawStatus = "unknown";
		this.checking = false;
		this.ocStartupGraceUntil = 0;
	}

	#startOpenClawGracePeriod(): void {
		this.ocStartupGraceUntil = Date.now() + this.OC_STARTUP_GRACE_PERIOD_MS;
	}

	#clearOpenClawGracePeriod(): void {
		this.ocStartupGraceUntil = 0;
	}

	#resetServiceHealthState(): void {
		this.healthStatus = "unknown";
		this.openClawStatus = "unknown";
	}

	#applyHealthStatus(status: string, ocStatus: string): void {
		this.healthStatus = status === "ok" ? "healthy" : "unhealthy";

		if (ocStatus === "ok") {
			this.openClawStatus = "healthy";
			this.#clearOpenClawGracePeriod();
			return;
		}

		if (this.starting || Date.now() < this.ocStartupGraceUntil) {
			this.openClawStatus = "unknown";
			return;
		}

		this.openClawStatus = "unhealthy";
	}

	async #createInstance(isDev: boolean, isAutoRenew: boolean) {
		return createInstance({ isDev, isAutoRenew });
	}

	async #listInstances() {
		return listInstances();
	}

	async #getInstanceStatus(instanceName: string) {
		return getInstanceStatus(instanceName);
	}

	async #getCloudSandboxHealth(publicIp: string, apiPort: number) {
		return getCloudSandboxHealth(publicIp, apiPort);
	}

	async #restartDocker(instanceName: string) {
		return restartDocker({ instanceName });
	}

	async #rebootInstance(instanceName: string) {
		return rebootInstance({ instanceName });
	}

	startPolling(intervalMs: number = POLL_INTERVAL_MS): void {
		this.pollingSubscriberCount += 1;
		if (this.pollingTimer) {
			return;
		}

		void this.checkStatus();
		this.pollingTimer = setInterval(() => {
			void this.checkStatus();
		}, intervalMs);
	}

	stopPolling(): void {
		if (this.pollingSubscriberCount > 0) {
			this.pollingSubscriberCount -= 1;
		}
		if (this.pollingSubscriberCount > 0) {
			return;
		}
		if (this.pollingTimer) {
			clearInterval(this.pollingTimer);
			this.pollingTimer = null;
		}
	}

	async checkStatus(): Promise<void> {
		this.checking = true;
		try {
			const listRes = await this.#listInstances();
			if (!listRes.success || !listRes.instances?.length) {
				this.activated = false;
				this.running = false;
				persistedCloudModeState.current = getDefaultInstanceInfo();
				this.instanceStatus = "unknown";
				this.#resetServiceHealthState();
				this.#clearOpenClawGracePeriod();
				return;
			}

			const info = listRes.instances[0];
			this.#updateState(info);
			this.activated = true;

			try {
				const statusRes = await this.#getInstanceStatus(info.instanceName);
				if (statusRes.success && statusRes.instance) {
					const wasRunning = this.running;
					this.running = statusRes.instance.instanceStatus === "Running";
					this.instanceStatus = this.running ? "healthy" : "unhealthy";
					if (this.running && !wasRunning) {
						this.#startOpenClawGracePeriod();
					}
				} else {
					this.running = false;
					this.instanceStatus = "unknown";
				}
			} catch (error) {
				logger.error("[CloudModeStateManager] Failed to get instance status:", error);
				this.running = false;
				this.instanceStatus = "unhealthy";
				this.#resetServiceHealthState();
				this.#clearOpenClawGracePeriod();
				return;
			}

			if (!this.running) {
				this.#resetServiceHealthState();
				this.#clearOpenClawGracePeriod();
				return;
			}

			if (info.publicIp && info.apiPort) {
				try {
					const healthRes = await this.#getCloudSandboxHealth(
						info.publicIp,
						info.apiPort,
					);
					if (healthRes.success) {
						this.#applyHealthStatus(healthRes.status, healthRes.ocStatus);
					} else {
						this.#resetServiceHealthState();
						this.#clearOpenClawGracePeriod();
					}
				} catch (error) {
					logger.error("[CloudModeStateManager] Failed to get sandbox health:", error);
					this.#resetServiceHealthState();
					this.#clearOpenClawGracePeriod();
				}
			} else {
				this.#resetServiceHealthState();
			}
		} catch (error) {
			logger.error("[CloudModeStateManager] Failed to check cloud status:", error);
		} finally {
			this.checking = false;
		}
	}

	async startCloud(isDev: boolean, isAutoRenew: boolean): Promise<boolean> {
		this.starting = true;
		try {
			const response = await this.#createInstance(isDev, isAutoRenew);
			this.#updateState(response.instance);
			this.activated = true;
			this.running = true;
			this.instanceStatus = "unknown";
			this.#resetServiceHealthState();
			this.#startOpenClawGracePeriod();
			return true;
		} catch (error) {
			logger.error("[CloudModeStateManager] Failed to start cloud:", error);
			return false;
		} finally {
			this.starting = false;
		}
	}

	async restartDocker(): Promise<boolean> {
		if (!this.instanceInfo?.instanceName) {
			return false;
		}
		try {
			this.#resetServiceHealthState();
			this.#startOpenClawGracePeriod();
			await this.#restartDocker(this.instanceInfo.instanceName);
			await this.checkStatus();
			return true;
		} catch (error) {
			logger.error("[CloudModeStateManager] Failed to restart docker:", error);
			return false;
		}
	}

	async rebootInstance(): Promise<boolean> {
		if (!this.instanceInfo?.instanceName) {
			return false;
		}
		try {
			this.#resetServiceHealthState();
			this.#startOpenClawGracePeriod();
			await this.#rebootInstance(this.instanceInfo.instanceName);
			await this.checkStatus();
			return true;
		} catch (error) {
			logger.error("[CloudModeStateManager] Failed to reboot instance:", error);
			return false;
		}
	}

	reset(): void {
		this.#resetRuntimeState();
		this.#updateState(getDefaultInstanceInfo());
	}
}

export const cloudModeState = new CloudModeStateManager();
