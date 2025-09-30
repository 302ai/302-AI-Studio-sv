/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BroadcastEvent } from "@shared/types";
import type { IpcMainInvokeEvent, WebContents, WebContentsView } from "electron";
import { BrowserWindow } from "electron";

export class BroadcastService {
	/**
	 * Broadcast to all webContents except the source webContents
	 */
	async broadcastExcludeSource(
		_event: IpcMainInvokeEvent,
		broadcastEvent: BroadcastEvent,
		data: any,
	): Promise<void> {
		const sourceWebContentsId = _event.sender.id;
		const allWebContents = this.getAllWebContents();

		allWebContents
			.filter((webContents) => webContents.id !== sourceWebContentsId)
			.forEach((webContents) =>
				this.sendBroadcast(webContents, broadcastEvent, data, sourceWebContentsId),
			);
	}

	private getAllWebContents(): WebContents[] {
		return BrowserWindow.getAllWindows().flatMap((window) => [
			window.webContents,
			...window.contentView.children
				.filter((childView): childView is WebContentsView => "webContents" in childView)
				.map((childView) => childView.webContents),
		]);
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
