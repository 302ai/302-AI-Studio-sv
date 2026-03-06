import { type IpcMainInvokeEvent } from "electron";
import fs from "fs/promises";
import { localVibeService } from "../local-vibe-service";

export class OpenClawService {
	async getOpenClawWebUiUrl(_event: IpcMainInvokeEvent) {
		const port = localVibeService.getRuntimeOpenClawPort();
		if (!port) return null;

		const configPath = localVibeService.getOpenClawConfigPath();
		let gatewayToken = "";

		try {
			const configContent = await fs.readFile(configPath, "utf-8");
			const config = JSON.parse(configContent);
			gatewayToken = config?.gateway?.auth?.token || "";
		} catch (error) {
			console.error("[OpenClawService] Failed to read or parse openclaw.json:", error);
		}

		return `http://localhost:${port}/?token=${gatewayToken}`;
	}
}

export const openClawService = new OpenClawService();
