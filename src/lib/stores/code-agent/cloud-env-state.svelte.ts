/**
 * Cloud Environment State Store
 *
 * Manages cloud mode activation, running status, health, and OpenClaw status.
 * Backend polling logic will be connected in a future task.
 */

export type CloudHealthStatus = "unknown" | "healthy" | "unhealthy";

class CloudEnvState {
	// Activation status (开通状态)
	activated = $state(false);

	// Running status (启动状态)
	running = $state(false);

	// Starting (transition state)
	starting = $state(false);

	// Health status (健康状态)
	healthStatus = $state<CloudHealthStatus>("unknown");

	// OpenClaw status
	openClawStatus = $state<CloudHealthStatus>("unknown");

	// Loading states
	checking = $state(false);

	/**
	 * Check cloud mode status (placeholder for future backend polling)
	 */
	async checkStatus(): Promise<void> {
		this.checking = true;
		try {
			// TODO: Connect to real backend API / IPC for status polling
		} catch (error) {
			console.error("[CloudEnvState] Failed to check cloud status:", error);
		} finally {
			this.checking = false;
		}
	}

	/**
	 * Start cloud sandbox (placeholder for future implementation)
	 */
	async startCloud(): Promise<boolean> {
		this.starting = true;
		try {
			// TODO: Connect to real backend API / IPC
			console.log("[CloudEnvState] startCloud: not implemented yet");
			return false;
		} catch (error) {
			console.error("[CloudEnvState] Failed to start cloud:", error);
			return false;
		} finally {
			this.starting = false;
		}
	}

	/**
	 * Stop cloud sandbox (placeholder for future implementation)
	 */
	async stopCloud(): Promise<boolean> {
		this.starting = true;
		try {
			// TODO: Connect to real backend API / IPC
			console.log("[CloudEnvState] stopCloud: not implemented yet");
			return false;
		} catch (error) {
			console.error("[CloudEnvState] Failed to stop cloud:", error);
			return false;
		} finally {
			this.starting = false;
		}
	}

	/**
	 * Reset state
	 */
	reset(): void {
		this.activated = false;
		this.running = false;
		this.starting = false;
		this.healthStatus = "unknown";
		this.openClawStatus = "unknown";
		this.checking = false;
	}
}

export const cloudEnvState = new CloudEnvState();
