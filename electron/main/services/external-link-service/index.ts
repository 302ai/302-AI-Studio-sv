import { shell, type IpcMainInvokeEvent } from "electron";

export class ExternalLinkService {
	async openExternalLink(
		_event: IpcMainInvokeEvent,
		url: string,
	): Promise<{
		isOk: boolean;
		error?: string;
	}> {
		try {
			await shell.openExternal(url);
			return { isOk: true };
		} catch (error) {
			console.error("Failed to open external link:", error);
			return { isOk: false, error: error as string };
		}
	}
}

export const externalLinkService = new ExternalLinkService();
