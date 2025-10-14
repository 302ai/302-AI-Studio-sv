/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BroadcastEvent } from "@shared/types";
import type { IpcMainInvokeEvent, WebContents } from "electron";
import { webContents } from "electron";
import mitt from "mitt";

export const emitter = mitt<{
	"persisted-state:sync": { sendKey: string; syncValue: any; sourceWebContentsId: number };
}>();

export class BroadcastService {
	constructor() {
		emitter.on("persisted-state:sync", ({ sendKey, syncValue, sourceWebContentsId }) => {
			this.broadcastExcludeSourceWC(sendKey, syncValue, sourceWebContentsId);
			// console.log("Broadcasting to all webContents ", sendKey, JSON.stringify(syncValue));
		});
	}

	private async broadcastExcludeSourceWC(
		sendKey: string,
		syncValue: any,
		sourceWebContentsId: number,
	): Promise<void> {
		const allWebContents = webContents.getAllWebContents();
		allWebContents
			.filter((wc) => wc.id !== sourceWebContentsId)
			.forEach((webContent) => webContent.send(sendKey, syncValue));
	}

	/**
	 * Broadcast to all webContents except the source webContents
	 */
	async broadcastExcludeSource(
		_event: IpcMainInvokeEvent,
		broadcastEvent: BroadcastEvent,
		data: any,
	): Promise<void> {
		const sourceWebContentsId = _event.sender.id;
		const allWebContents = webContents.getAllWebContents();

		allWebContents
			.filter((webContents) => webContents.id !== sourceWebContentsId)
			.forEach((webContents) =>
				this.sendBroadcast(webContents, broadcastEvent, data, sourceWebContentsId),
			);
	}

	async broadcastToAll(
		_event: IpcMainInvokeEvent,
		broadcastEvent: BroadcastEvent,
		data: any,
	): Promise<void> {
		const allWebContents = webContents.getAllWebContents();
		allWebContents.forEach((webContents) =>
			this.sendBroadcast(webContents, broadcastEvent, data, -1),
		);
	}

	private sendBroadcast(
		webContents: WebContents,
		broadcastEvent: BroadcastEvent,
		data: any,
		sourceWebContentsId: number,
	): void {
		try {
			webContents.send("broadcast-event", {
				broadcastEvent,
				data,
				sourceWebContentsId,
			});
		} catch (error) {
			console.error(
				`Failed to broadcast ${broadcastEvent} to webContents ${webContents.id}:`,
				error,
			);
		}
	}
}

export const broadcastService = new BroadcastService();
