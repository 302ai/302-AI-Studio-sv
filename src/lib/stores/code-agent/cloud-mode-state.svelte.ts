import {
	createInstance as createInstanceAPI,
	getSandboxHealthStatus,
	listInstances,
	manualRenew,
	restartDocker,
	updateInstanceAutoRenew,
} from "$lib/api/cloud-mode/base-apis";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import { createLogger } from "@shared/logger";
import type { InstanceInfo } from "@shared/storage/cloud-mode";
import { onDestroy, onMount } from "svelte";
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
	status: "waiting_init",
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
		status: persistedCloudModeState.current?.status ?? "waiting_init",
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

	healthProps = $derived.by(() => {
		const { status, expired, instanceName } = this.state;
		if (!instanceName || expired) {
			return { status: "gray" as const, text: m.cloud_mode_unknown() };
		}
		switch (status) {
			case "running":
				return { status: "green" as const, text: m.cloud_mode_healthy() };
			case "waiting_init":
				return { status: "gray" as const, text: m.cloud_mode_initializing() };
			case "rebooting":
				return { status: "gray" as const, text: m.cloud_mode_rebooting() };
			case "rebooted":
				return { status: "green" as const, text: m.cloud_mode_rebooted() };
			default:
				return { status: "gray" as const, text: m.cloud_mode_unknown() };
		}
	});

	loading = $state({
		init: false,
		status: false,
		restart: false,
		startVip: false,
		autoRenew: false,
		createOrRenew: false,
	});

	#isPolling = false;

	constructor() {
		window.electronAPI.cloudMode.onTimedBroadcaster(() => {
			this.loadStatus();
		});
	}

	#syncPollingState() {
		const shouldPoll = this.state.instanceName !== "" && !this.state.expired;
		if (shouldPoll && !this.#isPolling) {
			this.registerTimed();
			this.#isPolling = true;
			logger.info("[CloudModeStateManager] Started health polling");
		} else if (!shouldPoll && this.#isPolling) {
			this.unregisterTimed();
			this.#isPolling = false;
			logger.info("[CloudModeStateManager] Stopped health polling");
		}
	}

	init() {
		onMount(() => {
			try {
				cloudModeState.initStatus();
			} catch (e) {
				toast.error("云端环境状态加载失败，请稍后重试" + e);
			}
		});

		onDestroy(() => {
			cloudModeState.dispose();
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
			logger.debug(`[CloudModeStateManager] Executing command: ${key}=>${this.loading[key]}`);
			try {
				await fn();
			} catch (e) {
				logger.error(`[CloudModeStateManager] Error in ${key} command:`, e);
				return false;
			} finally {
				this.loading[key] = false;
				logger.debug(
					`[CloudModeStateManager] Executing command: ${key}=>${this.loading[key]}`,
				);
			}
			return true;
		};
	}

	async initStatus() {
		await this.loadingCommand("init", async () => {
			await this.loadInstances();
		})();
		this.#syncPollingState();
	}

	dispose() {
		if (this.#isPolling) {
			this.unregisterTimed();
			this.#isPolling = false;
		}
	}

	async loadInstances() {
		const res = await listInstances();
		if (!res.success && res.instances.length <= 0) {
			throw new Error("Failed to load cloud instance status");
		}
		const instance = res.instances[0];
		this.#updateState({
			instanceName: instance.instanceName,
			publicIp: instance.publicIp,
			createdAt: instance.createdAt,
			expiredAt: instance.expiredAt,
			expired: instance.expired,
			apiPort: instance.apiPort,
			ocPort: instance.ocPort,
			status: instance.status,
			autoRenew: instance.autoRenew,
		});
		this.#syncPollingState();
	}

	async loadStatus() {
		if (!this.state.instanceName || this.state.expired) {
			logger.debug("[CloudModeStateManager] Skipping health check — no valid instance");
			return;
		}
		await this.loadingCommand("status", async () => {
			const openclawResponse = await getSandboxHealthStatus(
				this.state.publicIp,
				this.state.apiPort,
			);
			if (!openclawResponse.success) {
				logger.error("Failed to get openclaw health status");
				throw new Error("Failed to get openclaw health status");
			}
			this.openClaw.status = openclawResponse.oc_status === "ok";
			this.openClaw.api_status = openclawResponse.status === "ok";
			logger.debug("Cloud instance status loaded successfully", {
				instance: this.state,
				openClawStatus: this.openClaw.status,
			});
		})();
	}

	async restartMachine() {
		await this.loadingCommand("restart", async () => {
			const res = await restartDocker({
				instanceName: this.state.instanceName,
				openclawConfigContent: "",
			});
			if (!res.success) {
				throw new Error("Failed to restart instance");
			}
			await this.loadStatus();
			logger.info("Instance restarted successfully");
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
			} catch (e) {
				this.#updateState({ autoRenew: originalAutoRenew });
				throw e;
			}
		})();
	}

	private async registerTimed() {
		window.electronAPI.cloudModeService.registerBroadcasterTimed();
	}

	private async unregisterTimed() {
		window.electronAPI.cloudModeService.unregisterBroadcasterTimed();
	}

	async createInstance() {
		await this.loadingCommand("createOrRenew", async () => {
			const isRenewal = !!this.state.instanceName;

			if (isRenewal) {
				const res = await manualRenew({
					instanceName: this.state.instanceName,
					isDev: true,
				});
				if (!res.success) {
					throw new Error("Failed to renew instance");
				}
				logger.info("Instance renewed successfully");
			} else {
				const res = await createInstanceAPI({
					isDev: true,
					isAutoRenew: this.state.autoRenew,
				});
				if (!res.success) {
					throw new Error("Failed to create instance");
				}
				logger.info("Instance created successfully");
			}

			await this.loadInstances();
		})();
	}
}

export const cloudModeState = new CloudModeStateManager();
