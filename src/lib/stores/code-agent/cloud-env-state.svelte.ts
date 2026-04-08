/**
 * Cloud Environment State Store
 *
 * Manages cloud mode activation, running status, health, and OpenClaw status.
 * Polls the compute gateway API every 30s to keep status up-to-date.
 */

import { createInstance } from "$lib/api/cloud-mode/base-apis";
import { createLogger } from "@shared/logger";
import type { InstanceInfo } from "@shared/storage/cloud-mode";

export type CloudHealthStatus = "unknown" | "healthy" | "unhealthy";

const console = createLogger("ui");

class CloudEnvState {
	// Activation status (开通状态)
	activated = $state(false);

	// Running status (启动状态)
	running = $state(false);

	// Starting (transition state)
	starting = $state(false);

	// Health status (健康状态) — sandbox API health
	healthStatus = $state<CloudHealthStatus>("unknown");

	// 实例状态
	instanceStatus = $state<CloudHealthStatus>("unknown");

	// OpenClaw status
	openClawStatus = $state<CloudHealthStatus>("unknown");

	// 接口状态
	apiStatus = $state<CloudHealthStatus>("unknown");

	// Instance info from API
	instanceInfo = $state<InstanceInfo | null>(null);

	// Loading states
	checking = $state(false);

	// Polling timer
	private pollingTimer: ReturnType<typeof setInterval> | null = null;

	/**
	 * Check cloud mode status.
	 * 1. List instances → determine if activated
	 * 2. Get instance status → determine if running
	 * 3. Hit sandbox health endpoint → determine healthStatus + openClawStatus
	 */
	// async checkStatus(): Promise<void> {
	// 	this.checking = true;
	// 	try {
	// 		const listRes = await listInstances();

	// 		// No instances → not activated
	// 		if (!listRes.success || !listRes.instances?.length) {
	// 			this.activated = false;
	// 			this.running = false;
	// 			this.instanceInfo = null;
	// 			this.instanceStatus = "unknown";
	// 			this.healthStatus = "unknown";
	// 			this.openClawStatus = "unknown";
	// 			this.apiStatus = "unknown";
	// 			return;
	// 		}

	// 		const info = listRes.instances[0];
	// 		this.instanceInfo = info;
	// 		this.activated = true;

	// 		// Query aliyun running status
	// 		const statusRes = await getInstanceStatus(info.instanceName);
	// 		if (statusRes.success && statusRes.instance) {
	// 			this.running = statusRes.instance.instanceStatus === "Running";
	// 			this.instanceStatus = this.running ? "healthy" : "unhealthy";
	// 		} else {
	// 			this.running = false;
	// 			this.instanceStatus = "unknown";
	// 		}

	// 		// Hit sandbox health endpoint (same as local mode, but on cloud instance IP)
	// 		if (info.publicIp && info.apiPort) {
	// 			const healthRes = await getCloudSandboxHealth(info.publicIp, info.apiPort);
	// 			if (healthRes.success) {
	// 				this.healthStatus = healthRes.status === "ok" ? "healthy" : "unhealthy";
	// 				this.openClawStatus = healthRes.ocStatus === "ok" ? "healthy" : "unhealthy";
	// 				this.apiStatus = "healthy";
	// 			} else {
	// 				this.healthStatus = "unhealthy";
	// 				this.openClawStatus = "unknown";
	// 				this.apiStatus = "unhealthy";
	// 			}
	// 		} else {
	// 			this.healthStatus = "unknown";
	// 			this.openClawStatus = "unknown";
	// 			this.apiStatus = "unknown";
	// 		}
	// 	} catch (error) {
	// 		console.error("[CloudEnvState] Failed to check cloud status:", error);
	// 		this.apiStatus = "unhealthy";
	// 	} finally {
	// 		this.checking = false;
	// 	}
	// }

	/**
	 * Start cloud sandbox by creating a compute instance.
	 */
	async startCloud(isDev: boolean, isAutoRenew: boolean): Promise<boolean> {
		this.starting = true;
		try {
			const response = await createInstance({ isDev, isAutoRenew });

			this.instanceInfo = response.instance;
			this.activated = true;
			this.running = true;
			this.instanceStatus = "healthy";
			this.apiStatus = "healthy";

			return true;
		} catch (error) {
			console.error("[CloudEnvState] Failed to start cloud:", error);
			return false;
		} finally {
			this.starting = false;
		}
	}

	/**
	 * Reset state.
	 */
	reset(): void {
		this.activated = false;
		this.running = false;
		this.starting = false;
		this.healthStatus = "unknown";
		this.instanceStatus = "unknown";
		this.openClawStatus = "unknown";
		this.apiStatus = "unknown";
		this.checking = false;
		this.instanceInfo = null;
	}
}

export const cloudEnvState = new CloudEnvState();
