/**
 * Local Environment State Store
 *
 * Manages Podman installation status, health status, and installation logs
 * for the Code Agent local mode.
 */

import { m } from "$lib/paraglide/messages";
import { toast } from "svelte-sonner";

export type PodmanHealthStatus = "unknown" | "healthy" | "unhealthy";
export type SandboxHealthStatus = "unknown" | "healthy" | "unhealthy";
export type PodmanComponentStatus = "unknown" | "missing" | "installed";

export interface InstallLogEntry {
	step: string;
	type: "start" | "stdout" | "stderr" | "complete" | "error";
	data: string;
	ts: number;
}

export interface PodmanHealthCheckData {
	isOk: boolean;
	isHealth: boolean;
	timestamp: number;
}

export interface PodmanValidationDetails {
	podmanInstalled: boolean;
	machineExists: boolean;
	composeInstalled: boolean;
}

class LocalEnvState {
	// Podman installation status
	podmanInstalled = $state(false);

	// Detailed component status for better diagnostics
	podmanComponentStatus = $state<PodmanValidationDetails>({
		podmanInstalled: false,
		machineExists: false,
		composeInstalled: false,
	});

	// Podman health status
	podmanHealth = $state<PodmanHealthStatus>("unknown");

	// Loading states
	checking = $state(false);
	installing = $state(false);
	sandboxStarting = $state(false);

	// Installation result
	installFailed = $state(false);

	// Sandbox running status (independent of podman health)
	sandboxRunning = $state(false);

	// Sandbox health status
	sandboxHealthStatus = $state<SandboxHealthStatus>("unknown");
	openClawHealthStatus = $state<SandboxHealthStatus>("unknown");

	// Installation logs
	installLogs = $state<InstallLogEntry[]>([]);

	// Sandbox startup logs
	sandboxLogs = $state<string[]>([]);
	sandboxFailed = $state(false);

	// OpenClaw startup grace period
	private ocStartupGraceUntil: number = 0;
	private readonly OC_STARTUP_GRACE_PERIOD_MS = 60000;

	// WSL restart required notification
	wslRestartRequired = $state<{
		reason: string;
		message: string;
	} | null>(null);

	// Unsubscribe functions for broadcast listeners
	private unsubscribeInstallLog: (() => void) | null = null;
	private unsubscribeHealthCheck: (() => void) | null = null;
	private unsubscribeSandboxHealth: (() => void) | null = null;
	private unsubscribeSandboxState: (() => void) | null = null;
	private unsubscribeSandboxInstallLog: (() => void) | null = null;

	// Sandbox-related install-log steps that should be synced to sandboxLogs
	private readonly sandboxInstallLogSteps = [
		"podman-machine-start",
		"podman-machine-start-recovery",
		"podman-machine-stop-recovery",
		"podman-machine-recover",
		"podman-compose-up",
		"podman-compose-pull",
		"podman-compose-stop",
	];

	// Health check resolvers for waiting on first health check after start
	private healthCheckResolvers: Array<() => void> = [];
	private unsubscribeWslRestart: (() => void) | null = null;

	constructor() {
		// Sync podmanInstalled status on initialization
		this.syncPodmanInstalledStatus();
	}

	/**
	 * Sync podmanInstalled status from main process on initialization
	 */
	private async syncPodmanInstalledStatus(): Promise<void> {
		try {
			const result = await window.electronAPI.localVibeService.validPodman();
			this.podmanInstalled = result.isOk && result.isValid;

			if (result.details) {
				this.podmanComponentStatus = result.details;
			}

			console.log("[LocalEnvState] Initial podmanInstalled sync:", this.podmanInstalled);
		} catch (error) {
			console.error("[LocalEnvState] Failed to sync initial podmanInstalled status:", error);
		}
	}

	/**
	 * Refresh Podman installation status by calling localVibeService.validPodman()
	 */
	async refreshPodmanStatus(): Promise<void> {
		this.checking = true;
		try {
			const result = await window.electronAPI.localVibeService.validPodman();
			this.podmanInstalled = result.isOk && result.isValid;

			// Save detailed component status for UI display
			if (result.details) {
				this.podmanComponentStatus = result.details;
			}

			// Print command output
			if (result.output) {
				console.log("[Local Vibe] validPodman:", result.output);
			}
			if (result.error) {
				console.error("[Local Vibe] validPodman error:", result.error);
			}
		} catch (error) {
			console.error("[LocalEnvState] Failed to check Podman status:", error);
			this.podmanInstalled = false;
		} finally {
			this.checking = false;
		}
	}

	/**
	 * Start Podman health check scheduler (only when Podman is installed)
	 */
	async ensurePodmanHealthCheckStarted(): Promise<void> {
		if (!this.podmanInstalled) {
			return;
		}

		try {
			await window.electronAPI.localVibeService.startPodmanHealthCheck();
		} catch (error) {
			console.error("[LocalEnvState] Failed to start Podman health check:", error);
		}
	}

	/**
	 * Install Podman - clears logs first, then calls localVibeService.installPodman()
	 */
	async installPodman(): Promise<void> {
		// Clear previous logs before starting new installation
		this.installLogs = [];
		this.installing = true;
		this.installFailed = false;

		try {
			const result = await window.electronAPI.localVibeService.installPodman();
			this.installFailed = !result.isOk;

			// Refresh status after installation
			await this.refreshPodmanStatus();

			// Start health check if installation succeeded
			if (result.isOk) {
				await this.ensurePodmanHealthCheckStarted();
			}
		} catch (error) {
			console.error("[LocalEnvState] Failed to install Podman:", error);
			this.installFailed = true;
		} finally {
			this.installing = false;
		}
	}

	/**
	 * Initialize Podman machine only (without installing prerequisites).
	 * Used on Windows where users manually install dependencies and only need machine init.
	 */
	async initMachine(): Promise<void> {
		// Pre-check: ensure podman CLI and podman-compose are installed
		try {
			const validation = await window.electronAPI.localVibeService.validPodman();
			const details = validation.details;
			if (!details?.podmanInstalled || !details?.composeInstalled) {
				toast.error(m.local_platform_prerequisites_missing());
				return;
			}
		} catch (error) {
			console.error("[LocalEnvState] Failed to validate Podman prerequisites:", error);
			toast.error(m.local_platform_prerequisites_missing());
			return;
		}

		this.installLogs = [];
		this.installing = true;
		this.installFailed = false;

		try {
			const result = await window.electronAPI.localVibeService.initPodmanMachine();
			this.installFailed = !result.isOk;

			await this.refreshPodmanStatus();

			if (result.isOk) {
				await this.ensurePodmanHealthCheckStarted();
			}
		} catch (error) {
			console.error("[LocalEnvState] Failed to init Podman machine:", error);
			this.installFailed = true;
		} finally {
			this.installing = false;
		}
	}

	/**
	 * Start Podman machine (sandbox)
	 * Calls localVibeService.startPodmanMachine() and prints output with [Local Vibe] prefix
	 */
	async startSandbox(): Promise<boolean> {
		// Ensure broadcast listeners are active before any state changes,
		// so waitForHealthCheck() can receive health check results.
		this.startSandboxListening();

		toast.info(m.code_agent_local_sandbox_starting());
		if (!this.podmanInstalled) {
			console.error("[LocalEnvState] Cannot start sandbox: Podman not installed");
			return false;
		}

		this.sandboxStarting = true;
		this.sandboxFailed = false;
		this.sandboxLogs = [];
		this.broadcastSandboxState({ starting: true });
		this.sandboxHealthStatus = "unknown";
		this.openClawHealthStatus = "unknown";
		try {
			const result = await window.electronAPI.localVibeService.startPodmanMachine();

			// Capture Podman machine output
			if (result.output) {
				console.log("[Local Vibe] startPodmanMachine:", result.output);
				this.sandboxLogs.push(`[INFO] [podman-machine] ${result.output}`);
			}
			if (result.error) {
				console.error("[Local Vibe] startPodmanMachine error:", result.error);
				this.sandboxLogs.push(`[ERROR] [podman-machine] ${result.error}`);
			}

			// Capture docker-compose output
			if (result.composeOutput) {
				console.log("[Local Vibe] docker-compose up:", result.composeOutput);
				this.sandboxLogs.push(`[INFO] [docker-compose] ${result.composeOutput}`);
			}
			if (result.composeError) {
				console.error("[Local Vibe] docker-compose error:", result.composeError);
				this.sandboxLogs.push(`[ERROR] [docker-compose] ${result.composeError}`);
			}

			if (!result.isOk) {
				this.sandboxFailed = true;
			}

			// Toggle sandbox running state on success
			if (result.isOk) {
				this.sandboxRunning = true;
				this.broadcastSandboxState({ running: true });
				this.sandboxHealthStatus = "unknown";
				this.openClawHealthStatus = "unknown";

				// Container started, internal services need time. Start grace period.
				this.ocStartupGraceUntil = Date.now() + this.OC_STARTUP_GRACE_PERIOD_MS;

				// Wait for the first health check result
				await this.waitForHealthCheck(100);
			}

			return result.isOk;
		} catch (error) {
			console.error("[LocalEnvState] Failed to start sandbox:", error);
			return false;
		} finally {
			this.sandboxStarting = false;
			this.broadcastSandboxState({ starting: false });
		}
	}

	/**
	 * Stop Podman machine (sandbox)
	 * Calls localVibeService.stopLocalSandboxByIpc() and prints output with [Local Vibe] prefix
	 */
	async stopSandbox(): Promise<boolean> {
		this.sandboxStarting = true;
		this.broadcastSandboxState({ starting: true });
		try {
			const result = await window.electronAPI.localVibeService.stopLocalSandboxByIpc();

			// Capture command output
			if (result.output) {
				console.log("[Local Vibe] stopLocalSandboxByIpc:", result.output);
				this.sandboxLogs.push(`[INFO] [stop-sandbox] ${result.output}`);
			}
			if (result.error) {
				console.error("[Local Vibe] stopLocalSandboxByIpc error:", result.error);
				this.sandboxLogs.push(`[ERROR] [stop-sandbox] ${result.error}`);
			}

			// Toggle sandbox running state on success
			if (result.isOk) {
				this.sandboxRunning = false;
				this.broadcastSandboxState({ running: false });
				this.sandboxHealthStatus = "unknown";
				this.openClawHealthStatus = "unknown";
				this.ocStartupGraceUntil = 0;
			}

			return result.isOk;
		} catch (error) {
			console.error("[LocalEnvState] Failed to stop sandbox:", error);
			return false;
		} finally {
			this.sandboxStarting = false;
			this.broadcastSandboxState({ starting: false });
		}
	}

	/**
	 * Start listening to Podman-related broadcast channels (install logs and health checks)
	 */
	startPodmanListening(): void {
		// Subscribe to install-log channel
		if (!this.unsubscribeInstallLog) {
			this.unsubscribeInstallLog = window.electronAPI.onInstallLog(
				(data: Omit<InstallLogEntry, "ts">) => {
					this.installLogs = [
						...this.installLogs,
						{
							...data,
							ts: Date.now(),
						},
					];
				},
			);
		}

		// Subscribe to podman-health-check channel
		if (!this.unsubscribeHealthCheck) {
			this.unsubscribeHealthCheck = window.electronAPI.onPodmanHealthCheck(
				(data: PodmanHealthCheckData) => {
					if (data.isOk) {
						this.podmanHealth = data.isHealth ? "healthy" : "unhealthy";
					} else {
						this.podmanHealth = "unknown";
					}

					console.log("[LocalEnvState] Podman health check:", this.podmanHealth);
				},
			);
		}

		// Subscribe to wsl-restart-required channel
		if (!this.unsubscribeWslRestart) {
			this.unsubscribeWslRestart = window.electronAPI.onWslRestartRequired(
				async (data: { reason: string; message: string }) => {
					this.wslRestartRequired = data;
					console.log("[LocalEnvState] WSL restart required:", data);

					// Show dialog immediately in the callback
					const result = confirm(
						`${data.message}\n\n点击"确定"立即重启系统，点击"取消"稍后手动重启。`,
					);

					if (result) {
						// User chose to restart now
						console.log("[LocalEnvState] User confirmed restart, triggering system restart...");
						await window.electronAPI.localVibeService.triggerSystemRestart();
					} else {
						console.log("[LocalEnvState] User cancelled restart");
					}

					// Clear the notification
					this.wslRestartRequired = null;
				},
			);
		}
	}

	/**
	 * Stop listening to Podman-related broadcast channels
	 */
	stopPodmanListening(): void {
		if (this.unsubscribeInstallLog) {
			this.unsubscribeInstallLog();
			this.unsubscribeInstallLog = null;
		}

		if (this.unsubscribeHealthCheck) {
			this.unsubscribeHealthCheck();
			this.unsubscribeHealthCheck = null;
		}
	}

	/**
	 * Broadcast sandbox state change to all tabs
	 */
	private broadcastSandboxState(state: { starting?: boolean; running?: boolean }): void {
		window.electronAPI.broadcastService.broadcastToAll("local-sandbox-state-changed", state);
	}

	/**
	 * Wait for the first health check result after starting the sandbox
	 * @param timeout Timeout in milliseconds (default: 10000ms)
	 * @returns Promise that resolves when health check arrives or timeout occurs
	 */
	private async waitForHealthCheck(timeout: number = 10000): Promise<void> {
		// If already healthy, return immediately
		if (this.sandboxHealthStatus === "healthy") {
			return;
		}

		return new Promise((resolve) => {
			const timeoutId = setTimeout(() => {
				// Remove this resolver from the array
				const index = this.healthCheckResolvers.indexOf(wrappedResolve);
				if (index > -1) {
					this.healthCheckResolvers.splice(index, 1);
				}
				console.warn("[LocalEnvState] Health check timeout, proceeding anyway");
				resolve();
			}, timeout);

			// Wrapped resolve that clears timeout
			const wrappedResolve = () => {
				clearTimeout(timeoutId);
				resolve();
			};

			// Add to waiting list
			this.healthCheckResolvers.push(wrappedResolve);
		});
	}

	/**
	 * Sync initial state from main process
	 * Used when a new tab is opened to check if sandbox is already running
	 */
	async syncInitialState(): Promise<void> {
		try {
			const status = (await window.electronAPI.localVibeService.getSandboxStatus()) as {
				isRunning: boolean;
				isOperating: boolean;
				isOcHealth: boolean;
			};
			if (status.isRunning) {
				this.sandboxRunning = true;
				this.sandboxHealthStatus = "healthy";
				if (status.isOcHealth) {
					this.openClawHealthStatus = "healthy";
				}
			}
			if (status.isOperating) {
				this.sandboxStarting = true;
			}
		} catch (error) {
			console.error("[LocalEnvState] Failed to sync initial state:", error);
		}
	}

	/**
	 * Check if an install-log step is related to sandbox operations
	 */
	private isSandboxInstallLogStep(step: string): boolean {
		return this.sandboxInstallLogSteps.some(
			(sandboxStep) => step === sandboxStep || step.startsWith(sandboxStep),
		);
	}

	/**
	 * Format install-log entry for sandbox logs
	 * Only shows step and data, filtering out start/complete type markers
	 */
	private formatSandboxLog(entry: InstallLogEntry): string | null {
		// Skip start and complete markers, only show actual output
		if (entry.type === "start" || entry.type === "complete") {
			return null;
		}
		return `[${entry.step}] ${entry.data}`;
	}

	/**
	 * Start listening to Sandbox-related broadcast channels.
	 * Returns the syncInitialState() promise so callers can await it if needed.
	 */
	startSandboxListening(): Promise<void> {
		// Sync initial state first
		const syncPromise = this.syncInitialState();

		// Subscribe to install-log channel for sandbox-related logs
		// This ensures real-time log updates while sandbox is starting/stopping
		if (!this.unsubscribeSandboxInstallLog) {
			this.unsubscribeSandboxInstallLog = window.electronAPI.onInstallLog(
				(data: Omit<InstallLogEntry, "ts">) => {
					if (this.isSandboxInstallLogStep(data.step)) {
						const entry: InstallLogEntry = { ...data, ts: Date.now() };
						const formatted = this.formatSandboxLog(entry);
						if (formatted) {
							this.sandboxLogs = [...this.sandboxLogs, formatted];
						}
					}
				},
			);
		}

		// Subscribe to local-sandbox-health-check channel
		if (!this.unsubscribeSandboxHealth) {
			this.unsubscribeSandboxHealth = window.electronAPI.onLocalSandboxHealthCheck(
				(data: {
					isOk: boolean;
					isHealth: boolean;
					isOcHealth: boolean;
					error?: string;
					timestamp: number;
				}) => {
					if (data.isOk) {
						if (data.isHealth) {
							this.sandboxHealthStatus = "healthy";
							// When sandbox is healthy, also set running state to true
							// so that new tabs can correctly display sandbox as started
							this.sandboxRunning = true;

							// Trigger all waiting health check resolvers
							this.healthCheckResolvers.forEach((resolve) => resolve());
							this.healthCheckResolvers = [];
						} else {
							this.sandboxHealthStatus = "unhealthy";
						}

						if (data.isOcHealth) {
							this.openClawHealthStatus = "healthy";
							this.ocStartupGraceUntil = 0;
						} else {
							// If during startup or within grace period, treat as unknown instead of unhealthy
							if (this.sandboxStarting || Date.now() < this.ocStartupGraceUntil) {
								this.openClawHealthStatus = "unknown";
							} else {
								this.openClawHealthStatus = "unhealthy";
							}
						}
					} else {
						this.sandboxHealthStatus = "unknown";
						this.openClawHealthStatus = "unknown";
						this.ocStartupGraceUntil = 0;
					}
					console.log(
						"[LocalEnvState] Sandbox health check:",
						this.sandboxHealthStatus,
						this.openClawHealthStatus,
						data.error ?? "no error",
					);
				},
			);
		}

		// Subscribe to local-sandbox-state-changed channel
		if (!this.unsubscribeSandboxState) {
			this.unsubscribeSandboxState = window.electronAPI.onLocalSandboxStateChanged(
				(data: { starting?: boolean; running?: boolean }) => {
					if (data.starting !== undefined) {
						// If another tab reports starting changed from true to false, start grace period
						if (this.sandboxStarting && !data.starting) {
							this.ocStartupGraceUntil = Date.now() + this.OC_STARTUP_GRACE_PERIOD_MS;
						}
						this.sandboxStarting = data.starting;
						console.log("[LocalEnvState] Sandbox starting state changed:", data.starting);
					}
					if (data.running !== undefined) {
						this.sandboxRunning = data.running;
						if (!data.running) {
							this.ocStartupGraceUntil = 0;
						}
						console.log("[LocalEnvState] Sandbox running state changed:", data.running);
					}
				},
			);
		}

		return syncPromise;
	}

	/**
	 * Stop listening to Sandbox-related broadcast channels
	 */
	stopSandboxListening(): void {
		if (this.unsubscribeSandboxHealth) {
			this.unsubscribeSandboxHealth();
			this.unsubscribeSandboxHealth = null;
		}

		if (this.unsubscribeSandboxState) {
			this.unsubscribeSandboxState();
			this.unsubscribeSandboxState = null;
		}

		if (this.unsubscribeSandboxInstallLog) {
			this.unsubscribeSandboxInstallLog();
			this.unsubscribeSandboxInstallLog = null;
		}
	}

	/**
	 * Clear installation logs
	 */
	clearLogs(): void {
		this.installLogs = [];
	}

	/**
	 * Reset state (useful when switching away from local mode)
	 */
	reset(): void {
		this.podmanHealth = "unknown";
		this.installFailed = false;
	}

	/**
	 * Ensures the local sandbox is running, starting it if necessary.
	 * This is an idempotent operation - safe to call multiple times.
	 * Shares state with SandboxCard via sandboxStarting flag.
	 * @returns { isOk: boolean; port?: number; error?: string; wasAlreadyRunning: boolean }
	 */
	async ensureSandboxRunning(): Promise<{
		isOk: boolean;
		port?: number;
		error?: string;
		wasAlreadyRunning: boolean;
	}> {
		// Ensure broadcast listeners are active so health check updates are received,
		// even when called from non-UI contexts (chat-state, send-message-button-state, etc.)
		this.startSandboxListening();

		// If already starting, wait for completion (prevent concurrent starts)
		if (this.sandboxStarting) {
			// Wait for the current start operation to complete
			await new Promise<void>((resolve) => {
				const checkInterval = setInterval(() => {
					if (!this.sandboxStarting) {
						clearInterval(checkInterval);
						resolve();
					}
				}, 100);
			});
			// Return current state after waiting
			return {
				isOk: this.sandboxRunning,
				wasAlreadyRunning: true,
			};
		}

		// Check if already running and healthy
		if (this.sandboxRunning && this.sandboxHealthStatus === "healthy") {
			return { isOk: true, wasAlreadyRunning: true };
		}

		// Call IPC method to ensure sandbox is running
		// This sets sandboxStarting internally via startSandbox flow
		this.sandboxStarting = true;
		this.broadcastSandboxState({ starting: true });
		this.sandboxHealthStatus = "unknown";

		try {
			const result = await window.electronAPI.localVibeService.ensureLocalSandboxRunning();

			if (result.isOk) {
				this.sandboxRunning = true;
			}

			return {
				isOk: result.isOk,
				port: result.port,
				error: result.error,
				wasAlreadyRunning: result.wasAlreadyRunning,
			};
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[LocalEnvState] Failed to ensure sandbox running:", errorMessage);
			return { isOk: false, error: errorMessage, wasAlreadyRunning: false };
		} finally {
			this.sandboxStarting = false;
			this.broadcastSandboxState({ starting: false });
		}
	}
}

export const localEnvState = new LocalEnvState();
