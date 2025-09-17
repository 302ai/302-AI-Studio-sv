import { ServiceRegister, ServiceHandler } from "@electron/reflect";
import { shell } from "electron";

@ServiceRegister("attachmentsService")
class AttachmentsService {
	@ServiceHandler()
	async openExternal(_event: Electron.IpcMainEvent, url: string) {
		try {
			await shell.openExternal(url);
		} catch (error) {
			console.error("AttachmentsService:openExternal error", { error });
			throw error;
		}
	}
}

export const attachmentsService = new AttachmentsService();
