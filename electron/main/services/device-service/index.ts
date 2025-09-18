import type { IpcMainInvokeEvent } from "electron";

export class DeviceService {
	async getPlatform(_event: IpcMainInvokeEvent) {
		return process.platform;
	}
}

export const deviceService = new DeviceService();
