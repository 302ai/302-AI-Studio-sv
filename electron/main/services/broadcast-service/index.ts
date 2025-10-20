/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BroadcastEvent } from "@shared/types";
import type { IpcMainInvokeEvent, WebContents } from "electron";
import { webContents } from "electron";
import mitt from "mitt";

export const emitter = mitt<{
	"persisted-state:before-set": { key: string; value: any; sourceWebContentsId: number };
	"persisted-state:sync": { sendKey: string; syncValue: any; storageKey: string };
}>();

interface PendingSync {
	key: string;
	sourceWebContentsId: number;
	timestamp: number;
}

interface QueuedEvent {
	id: string;
	timestamp: number;
	sendKey: string;
	syncValue: any;
	sourceWebContentsId: number;
	storageKey: string; // 原始storage key
}

export class BroadcastService {
	private eventQueue: QueuedEvent[] = [];
	private isProcessing = false;
	private readonly BATCH_SIZE = 10;
	private readonly BATCH_TIMEOUT = 16; // ~1 frame at 60fps
	private batchTimer?: NodeJS.Timeout;
	private pendingSyncs = new Map<string, PendingSync>(); // key -> {key, sourceWebContentsId, timestamp}

	constructor() {
		// 监听before-set事件，记录source信息
		emitter.on("persisted-state:before-set", ({ key, sourceWebContentsId }) => {
			this.pendingSyncs.set(key, {
				key,
				sourceWebContentsId,
				timestamp: Date.now(),
			});
			console.log(
				`[BroadcastService] Recording pending sync for key: ${key}, source: ${sourceWebContentsId}`,
			);
		});

		// 监听storage同步事件，加入队列而不是立即处理
		emitter.on("persisted-state:sync", (eventData) => {
			this.enqueueEvent(eventData);
		});
	}

	/**
	 * 将事件加入队列，从pendingSyncs中获取sourceWebContentsId
	 */
	private enqueueEvent({
		sendKey,
		syncValue,
		storageKey,
	}: {
		sendKey: string;
		syncValue: any;
		storageKey: string;
	}): void {
		// 从pendingSyncs中获取source信息
		const pendingSync = this.pendingSyncs.get(storageKey);
		const sourceWebContentsId = pendingSync?.sourceWebContentsId ?? -1;

		const event: QueuedEvent = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			timestamp: Date.now(),
			sendKey,
			syncValue,
			sourceWebContentsId,
			storageKey,
		};

		this.eventQueue.push(event);
		console.log(
			`[BroadcastService] Event enqueued: ${event.id}, storageKey: ${storageKey}, sendKey: ${sendKey}, source: ${sourceWebContentsId}`,
		);

		// 触发批处理
		this.scheduleBatchProcess();
	}

	/**
	 * 调度批处理
	 */
	private scheduleBatchProcess(): void {
		if (this.batchTimer) {
			return; // 已经有定时器在运行
		}

		this.batchTimer = setTimeout(() => {
			this.processBatch();
			this.batchTimer = undefined;
		}, this.BATCH_TIMEOUT);
	}

	/**
	 * 批量处理事件队列
	 */
	private async processBatch(): Promise<void> {
		if (this.isProcessing || this.eventQueue.length === 0) {
			return;
		}

		this.isProcessing = true;

		try {
			// 取出一批事件进行处理
			const eventsToProcess = this.eventQueue.splice(0, this.BATCH_SIZE);

			// 按storageKey分组，对每个storageKey只处理最新的事件
			const latestEventsByKey = new Map<string, QueuedEvent>();

			for (const event of eventsToProcess) {
				const existing = latestEventsByKey.get(event.storageKey);
				if (!existing || event.timestamp > existing.timestamp) {
					latestEventsByKey.set(event.storageKey, event);
				}
			}

			console.log(
				`[BroadcastService] Processing batch: ${latestEventsByKey.size} unique keys from ${eventsToProcess.length} events`,
			);

			// 处理每个storageKey的最新事件
			for (const event of latestEventsByKey.values()) {
				await this.broadcastExcludeSourceWC(
					event.sendKey,
					event.syncValue,
					event.sourceWebContentsId,
				);

				// 处理完成后清理pendingSync
				this.pendingSyncs.delete(event.storageKey);
			}

			// 如果还有剩余事件，继续处理
			if (this.eventQueue.length > 0) {
				this.scheduleBatchProcess();
			}
		} catch (error) {
			console.error("[BroadcastService] Error processing batch:", error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * 立即处理所有队列中的事件（用于特殊情况）
	 */
	async flushQueue(): Promise<void> {
		while (this.eventQueue.length > 0) {
			await this.processBatch();
		}
	}

	private async broadcastExcludeSourceWC(
		sendKey: string,
		syncValue: any,
		sourceWebContentsId: number,
	): Promise<void> {
		const allWebContents = webContents.getAllWebContents();
		const targets = allWebContents.filter((wc) => wc.id !== sourceWebContentsId);

		if (targets.length > 0) {
			console.log(
				`[BroadcastService] Broadcasting ${sendKey} to ${targets.length} webContents, excluding ${sourceWebContentsId}`,
			);
			targets.forEach((webContent) => webContent.send(sendKey, syncValue));
		}
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

	/**
	 * Broadcast a custom channel to all webContents (for main process use)
	 */
	broadcastChannelToAll(channel: string, data?: any): void {
		const allWebContents = webContents.getAllWebContents();
		allWebContents.forEach((wc) => {
			if (!wc.isDestroyed()) {
				try {
					wc.send(channel, data);
				} catch (error) {
					console.error(`Failed to broadcast ${channel} to webContents ${wc.id}:`, error);
				}
			}
		});
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

	/**
	 * 获取队列状态（用于调试）
	 */
	getQueueStatus(): { queueLength: number; isProcessing: boolean } {
		return {
			queueLength: this.eventQueue.length,
			isProcessing: this.isProcessing,
		};
	}
}

export const broadcastService = new BroadcastService();
