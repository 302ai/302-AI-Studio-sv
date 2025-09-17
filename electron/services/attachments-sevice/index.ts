import { shell } from "electron";

export class AttachmentsService {
	private url = "https://baidu.com";

	constructor() {
		console.log(
			"AttachmentsServiceAttachmentsServiceAttachmentsServiceAttachmentsServiceAttachmentsService constructor",
		);
	}

	async openExternal(_event: Electron.IpcMainInvokeEvent, url: string) {
		try {
			console.log("AttachmentsService:openExternal", { url });
			await shell.openExternal(url);
		} catch (error) {
			console.error("AttachmentsService:openExternal error", { error });
			throw error;
		}
	}

	async openExternal2(_event: Electron.IpcMainInvokeEvent, url: string) {
		try {
			console.log("AttachmentsService:openExternal2", { url });
			await shell.openExternal(this.url);
		} catch (error) {
			console.error("AttachmentsService:openExternal error", { error });
			throw error;
		}
	}

	async openExternal3(_event: Electron.IpcMainInvokeEvent, url: string) {
		try {
			console.log("AttachmentsService:openExternal3", { url });
			await shell.openExternal(url);
		} catch (error) {
			console.error("AttachmentsService:openExternal error", { error });
			throw error;
		}
	}

	async openExternal4(_event: Electron.IpcMainInvokeEvent, url: string) {
		try {
			console.log("AttachmentsService:openExternal3", { url });
			await shell.openExternal(url);
		} catch (error) {
			console.error("AttachmentsService:openExternal error", { error });
			throw error;
		}
	}
}
