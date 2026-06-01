import type { InstanceInfo } from "@shared/storage/cloud-mode";
import { describe, expect, it } from "vitest";
import { buildCloudModeInstanceBaseUrl } from "./cloud-mode-base-url";

const makeInstance = (overrides: Partial<InstanceInfo> = {}): InstanceInfo => ({
	instanceName: "instance-1",
	publicIp: "1.2.3.4",
	createdAt: "",
	expiredAt: "",
	expired: false,
	apiPort: 8080,
	ocPort: 3000,
	status: "running",
	autoRenew: true,
	destroyedAt: undefined,
	...overrides,
});

describe("buildCloudModeInstanceBaseUrl", () => {
	it("returns a base URL for a valid cloud instance", () => {
		expect(buildCloudModeInstanceBaseUrl(makeInstance())).toEqual({
			isOk: true,
			baseUrl: "http://1.2.3.4:8080",
		});
	});

	it("rejects an instance without public IP and API port", () => {
		expect(buildCloudModeInstanceBaseUrl(makeInstance({ publicIp: "", apiPort: 0 }))).toEqual({
			isOk: false,
			baseUrl: "",
		});
	});

	it("rejects expired instances", () => {
		expect(buildCloudModeInstanceBaseUrl(makeInstance({ expired: true }))).toEqual({
			isOk: false,
			baseUrl: "",
		});
	});
});
