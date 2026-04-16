import {
	createInstance,
	manualRenew,
	readInstanceFiles,
	rebootInstance,
	restartDocker,
	updateInstanceAutoRenew,
} from "$lib/api/cloud-mode/base-apis";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import { createLogger } from "@shared/logger";
import type { InstanceInfo } from "@shared/storage/cloud-mode";
import { CloudModeApiError } from "@shared/storage/cloud-mode-errors";
import { onMount } from "svelte";
import { toast } from "svelte-sonner";

const logger = createLogger("state");

export const getDefaultInstanceInfo = (): InstanceInfo => ({
	instanceName: "",
	publicIp: "",
	createdAt: "",
	expiredAt: "",
	expired: false,
	apiPort: 0,
	ocPort: 0,
	status: "disabled",
	autoRenew: true,
	destroyedAt: undefined,
});

export const persistedCloudModeState = new PersistedState<InstanceInfo>(
	"CloudModeStorage:state",
	getDefaultInstanceInfo(),
);

class CloudModeStateManager {
	// cloud state
	state = $derived({
		instanceName: persistedCloudModeState.current?.instanceName ?? "",
		status: persistedCloudModeState.current?.status ?? "disabled",
		expired: persistedCloudModeState.current?.expired ?? false,
		publicIp: persistedCloudModeState.current?.publicIp ?? "",
		createdAt: persistedCloudModeState.current?.createdAt ?? "",
		expiredAt: persistedCloudModeState.current?.expiredAt ?? "",
		apiPort: persistedCloudModeState.current?.apiPort ?? 0,
		ocPort: persistedCloudModeState.current?.ocPort ?? 0,
		autoRenew: persistedCloudModeState.current?.autoRenew ?? true,
	});

	openClaw = $state({
		status: null as boolean | null,
		api_status: null as boolean | null,
	});

	#bufferTimeout: ReturnType<typeof setTimeout> | null = $state(null);

	healthProps = $derived.by(() => {
		const { status } = this.state;
		switch (status) {
			case "running":
				return { status: "green" as const, text: m.cloud_mode_healthy() };
			case "waiting_init":
				return { status: "gray" as const, text: m.cloud_mode_initializing() };
			case "rebooting":
				return { status: "gray" as const, text: m.cloud_mode_rebooting() };
			case "rebooted":
				return { status: "green" as const, text: m.cloud_mode_rebooted() };
			case "pending":
				return { status: "gray" as const, text: m.cloud_mode_pending() };
			case "starting":
				return { status: "gray" as const, text: m.cloud_mode_starting() };
			case "stopping":
				return { status: "gray" as const, text: m.cloud_mode_stopping() };
			case "resetting":
				return { status: "gray" as const, text: m.cloud_mode_resetting() };
			case "upgrading":
				return { status: "gray" as const, text: m.cloud_mode_upgrading() };
			case "disabled":
				return { status: "gray" as const, text: m.cloud_mode_disabled() };
			default:
				return { status: "gray" as const, text: m.cloud_mode_unknown() };
		}
	});

	loading = $state({
		init: false,
		status: false,
		restart: false,
		restartOpenClaw: false,
		startVip: false,
		autoRenew: false,
		createOrRenew: false,
	});

	constructor() {
		window.electronAPI.cloudMode.onTimedBroadcaster((healthData) => {
			if (!healthData) {
				// Clear health status when backend broadcasts null
				this.openClaw.status = null;
				this.openClaw.api_status = null;
				return;
			}

			// During buffer period, ignore non-ok status to prevent flickering
			if (this.#bufferTimeout !== null && healthData.oc_status !== "ok") {
				return;
			}

			// Update health status
			this.openClaw.status = healthData.oc_status === "ok";
			this.openClaw.api_status = healthData.status === "ok";
		});
	}

	/**
	 * Unified post-operation handler: Sync + Start polling + Refresh health
	 */
	private async afterInstanceOperation(): Promise<void> {
		try {
			// 1. Sync instance info and start polling
			const res = await window.electronAPI.cloudModeService.syncAndStartPollingByIpc();
			if (!res.isOk) {
				logger.warn("[CloudModeStateManager] Sync after operation failed");
			}

			// 2. Immediately refresh health status (don't wait for 30s polling)
			// await window.electronAPI.cloudModeService.refreshHealthByIpc();
		} catch (e) {
			logger.error("[CloudModeStateManager] afterInstanceOperation failed:", e);
		}
	}

	init() {
		onMount(() => {
			try {
				cloudModeState.initStatus();
			} catch (e) {
				toast.error("Failed to load cloud instance status, please retry later" + e);
			}
		});

		return this;
	}

	#updateState(partial: Partial<InstanceInfo>): void {
		logger.debug("[CloudModeStateManager] updateState", partial);
		persistedCloudModeState.current = {
			...(persistedCloudModeState.current ?? getDefaultInstanceInfo()),
			...partial,
		};
	}

	private loadingCommand(
		key: keyof CloudModeStateManager["loading"],
		fn: () => Promise<void>,
	): () => Promise<boolean> {
		return async () => {
			this.loading[key] = true;

			try {
				await fn();
			} catch (e) {
				logger.error(`[CloudModeStateManager] Error in ${key} command:`, e);
				throw e;
			} finally {
				this.loading[key] = false;
			}
			return true;
		};
	}

	async initStatus() {
		await this.loadingCommand("init", async () => {
			await this.loadInstances();
		})();

		// Immediately get health status from main process cache without waiting for 60s polling
		try {
			const cached = await window.electronAPI.cloudModeService.getHealthStatusByIpc();
			if (cached) {
				this.openClaw.status = cached.oc_status === "ok";
				this.openClaw.api_status = cached.status === "ok";
				logger.debug(
					"[CloudModeStateManager] Loaded cached health status from main process",
				);
			}
		} catch (e) {
			logger.debug("[CloudModeStateManager] Failed to get cached health status", e);
		}
	}

	/**
	 * Unified Cloud Mode error handler: resolves i18n message, shows toast, and re-throws.
	 * Returns `never` so TypeScript knows the catch block always throws.
	 */
	#handleError(error: unknown): never {
		if (error instanceof CloudModeApiError) {
			const i18nKey = error.getI18nKey();
			const messageFunc = (m as unknown as Record<string, () => string>)[i18nKey];
			toast.error(messageFunc ? messageFunc() : m.cloud_mode_error_unknown());
		} else {
			toast.error(m.cloud_mode_error_unknown());
		}
		throw error;
	}

	async loadInstances() {
		try {
			const res = await window.electronAPI.cloudModeService.syncCloudInstanceToLocalByIpc();
			if (!res.isOk) {
				const errorInfo = res.error;
				throw new CloudModeApiError(
					errorInfo?.code ?? "UNKNOWN_ERROR",
					errorInfo?.message ?? "Failed to load cloud instance status",
				);
			}
		} catch (error) {
			this.#handleError(error);
		}
	}

	async restartMachine() {
		await this.loadingCommand("restart", async () => {
			try {
				const res = await rebootInstance({
					instanceName: this.state.instanceName,
				});
				if (!res.success) {
					throw new Error("Failed to restart instance");
				}

				// Unified handler: sync + start polling
				await this.afterInstanceOperation();
			} catch (error) {
				this.#handleError(error);
			}
		})();
	}

	async restartOpenClaw() {
		await this.loadingCommand("restartOpenClaw", async () => {
			try {
				const res = await restartDocker({
					instanceName: this.state.instanceName,
				});
				if (!res.success) {
					throw new Error("Failed to restart OpenClaw");
				}

				// Unified handler: sync + start polling
				await this.afterInstanceOperation();
			} catch (error) {
				this.#handleError(error);
			}
		})();
	}

	async updateAutoRenew(autoRenew: boolean) {
		await this.loadingCommand("autoRenew", async () => {
			const originalAutoRenew = this.state.autoRenew;
			this.#updateState({ autoRenew });
			try {
				const res = await updateInstanceAutoRenew({
					instanceName: this.state.instanceName,
					isAutoRenew: autoRenew,
				});
				if (!res.success) {
					throw new Error("Failed to update auto-renew setting");
				}
				logger.info("Auto-renew setting updated successfully");
			} catch (error) {
				this.#updateState({ autoRenew: originalAutoRenew });
				this.#handleError(error);
			}
		})();
	}

	async getOpenClawWebUiUrl(): Promise<string | null> {
		const { publicIp, ocPort, instanceName } = this.state;
		if (!publicIp || !ocPort || !instanceName) return null;

		try {
			const response = await readInstanceFiles({
				instanceName,
				filePaths: ["/home/user/.openclaw/openclaw.json"],
			});

			const fileContent = response.files[0]?.fileContent;
			if (!fileContent) return null;

			const config = JSON.parse(fileContent) as {
				gateway?: { auth?: { token?: string } };
			};
			const token = config?.gateway?.auth?.token || "";
			return `http://${publicIp}:${ocPort}/#token=${token}`;
		} catch (e) {
			logger.error("Failed to get cloud OpenClaw WebUI URL:", e);
			return null;
		}
	}

	async createInstance() {
		await this.loadingCommand("createOrRenew", async () => {
			try {
				const isRenewal = !!this.state.instanceName;

				if (isRenewal) {
					const res = await manualRenew({
						instanceName: this.state.instanceName,
						isDev: false, // TODO: remove this when ready
					});
					if (!res.success) {
						throw new Error("Failed to renew instance");
					}
					logger.info("Instance renewed successfully");
				} else {
					const res = await createInstance({
						isDev: false, // TODO: remove this when ready
						isAutoRenew: this.state.autoRenew,
					});
					if (!res.success) {
						throw new Error("Failed to create instance");
					}

					logger.info("Instance created successfully");
				}

				// Unified handler: sync + start polling
				await this.afterInstanceOperation();
			} catch (error) {
				this.#handleError(error);
			}
		})();
	}
}

export const cloudModeState = new CloudModeStateManager();
