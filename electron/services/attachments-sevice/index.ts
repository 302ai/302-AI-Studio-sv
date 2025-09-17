import { ServiceRegister, ServiceHandler } from "@electron/reflect";
import { shell } from "electron";

@ServiceRegister("attachmentsService")
export class AttachmentsService {
	private url = "https://baidu.com";

	constructor() {
		console.log(
			"AttachmentsServiceAttachmentsServiceAttachmentsServiceAttachmentsServiceAttachmentsService constructor",
		);
	}

	@ServiceHandler()
	async openExternal(_event: Electron.IpcMainEvent, url: string) {
		try {
			console.log("AttachmentsService:openExternal", { url });
			await shell.openExternal(url);
		} catch (error) {
			console.error("AttachmentsService:openExternal error", { error });
			throw error;
		}
	}

	@ServiceHandler()
	async openExternal2(_event: Electron.IpcMainEvent, url: string) {
		try {
			console.log("AttachmentsService:openExternal2", { url });
			await shell.openExternal(this.url);
		} catch (error) {
			console.error("AttachmentsService:openExternal error", { error });
			throw error;
		}
	}

	@ServiceHandler()
	async openExternal3(_event: Electron.IpcMainEvent, url: string) {
		try {
			console.log("AttachmentsService:openExternal3", { url });
			await shell.openExternal(url);
		} catch (error) {
			console.error("AttachmentsService:openExternal error", { error });
			throw error;
		}
	}
}
