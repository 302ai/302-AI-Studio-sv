import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { createLogger } from "@shared/logger";
import { type InstanceInfo } from "@shared/storage/cloud-mode";

const logger = createLogger("state");

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
	instanceName = $derived(persistedCloudModeState.current?.instanceName ?? "");
	publicIp = $derived(persistedCloudModeState.current?.publicIp ?? "");
	createdAt = $derived(persistedCloudModeState.current?.createdAt ?? "");
	expiredAt = $derived(persistedCloudModeState.current?.expiredAt ?? "");
	apiPort = $derived(persistedCloudModeState.current?.apiPort ?? 0);
	ocPort = $derived(persistedCloudModeState.current?.ocPort ?? 0);
	openclawGatewayToken = $derived(persistedCloudModeState.current?.openclawGatewayToken ?? "");

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

	reset(): void {
		this.#updateState(getDefaultInstanceInfo());
	}
}

export const cloudModeState = new CloudModeStateManager();
