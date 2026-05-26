import type { InstanceInfo } from "@shared/storage/cloud-mode";

export function buildCloudModeInstanceBaseUrl(instance: InstanceInfo): {
	isOk: boolean;
	baseUrl: string;
} {
	if (!instance.publicIp || instance.apiPort <= 0 || instance.expired) {
		return { isOk: false, baseUrl: "" };
	}

	return { isOk: true, baseUrl: `http://${instance.publicIp}:${instance.apiPort}` };
}
