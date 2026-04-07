/**
 * Cloud Environment State Store
 *
 * Manages cloud mode activation, running status, health, and OpenClaw status.
 * Polls the compute gateway API every 30s to keep status up-to-date.
 */

import { createLogger } from "@shared/logger";
import {
	createInstance,
	listInstances,
	getInstanceStatus,
	getCloudSandboxHealth,
	type InstanceInfo,
} from "$lib/api/cloud-instance";

export type CloudHealthStatus = "unknown" | "healthy" | "unhealthy";

const console = createLogger("ui");

/** Default polling interval: 30 seconds */
const POLL_INTERVAL_MS = 30_000;

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
	 * Start periodic status polling.
	 * If already polling, this is a no-op.
	 */
	startPolling(intervalMs: number = POLL_INTERVAL_MS): void {
		if (this.pollingTimer) return;
		// Initial check immediately
		this.checkStatus();
		this.pollingTimer = setInterval(() => this.checkStatus(), intervalMs);
	}

	/**
	 * Stop periodic status polling.
	 */
	stopPolling(): void {
		if (this.pollingTimer) {
			clearInterval(this.pollingTimer);
			this.pollingTimer = null;
		}
	}

	/**
	 * Check cloud mode status.
	 * 1. List instances → determine if activated
	 * 2. Get instance status → determine if running
	 * 3. Hit sandbox health endpoint → determine healthStatus + openClawStatus
	 */
	async checkStatus(): Promise<void> {
		this.checking = true;
		try {
			const listRes = await listInstances();

			// No instances → not activated
			if (!listRes.success || !listRes.instances?.length) {
				this.activated = false;
				this.running = false;
				this.instanceInfo = null;
				this.instanceStatus = "unknown";
				this.healthStatus = "unknown";
				this.openClawStatus = "unknown";
				this.apiStatus = "unknown";
				return;
			}

			const info = listRes.instances[0];
			this.instanceInfo = info;
			this.activated = true;

			// Query aliyun running status
			const statusRes = await getInstanceStatus(info.instance_name);
			if (statusRes.success && statusRes.instance) {
				this.running = statusRes.instance.instance_status === "Running";
				this.instanceStatus = this.running ? "healthy" : "unhealthy";
			} else {
				this.running = false;
				this.instanceStatus = "unknown";
			}

			// Hit sandbox health endpoint (same as local mode, but on cloud instance IP)
			if (info.public_ip && info.api_port) {
				const healthRes = await getCloudSandboxHealth(info.public_ip, info.api_port);
				if (healthRes.success) {
					this.healthStatus = healthRes.status === "ok" ? "healthy" : "unhealthy";
					this.openClawStatus = healthRes.oc_status === "ok" ? "healthy" : "unhealthy";
					this.apiStatus = "healthy";
				} else {
					this.healthStatus = "unhealthy";
					this.openClawStatus = "unknown";
					this.apiStatus = "unhealthy";
				}
			} else {
				this.healthStatus = "unknown";
				this.openClawStatus = "unknown";
				this.apiStatus = "unknown";
			}
		} catch (error) {
			console.error("[CloudEnvState] Failed to check cloud status:", error);
			this.apiStatus = "unhealthy";
		} finally {
			this.checking = false;
		}
	}

	/**
	 * Start cloud sandbox by creating a compute instance.
	 */
	async startCloud(): Promise<boolean> {
		this.starting = true;
		try {
			const response = await createInstance({ is_dev: true });

			if (response.success && response.instance) {
				this.instanceInfo = response.instance;
				this.activated = true;
				this.running = true;
				this.instanceStatus = "healthy";
				this.apiStatus = "healthy";
				return true;
			}

			// Instance already exists — treat as activated, refresh status
			if (response.error?.includes("APIKEY_INSTANCE_EXISTS")) {
				await this.checkStatus();
				return true;
			}

			console.error("[CloudEnvState] Failed to create instance:", response.error);
			return false;
		} catch (error) {
			console.error("[CloudEnvState] Failed to start cloud:", error);
			return false;
		} finally {
			this.starting = false;
		}
	}

	/**
	 * Reset state and stop polling.
	 */
	reset(): void {
		this.stopPolling();
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
