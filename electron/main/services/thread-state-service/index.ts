import type { IpcMainInvokeEvent } from "electron";
import { broadcastService, emitter } from "../broadcast-service";
import { codeAgentStorage } from "../storage-service/code-agent/code-agent-storage";

export class ThreadStateService {
	private busyThreads = new Map<string, { isBusy: boolean; reason?: string }>();

	/**
	 * Update thread busy state and broadcast to all
	 */
	async updateBusyState(
		_event: IpcMainInvokeEvent,
		data: { threadId: string; isBusy: boolean; reason?: string },
	): Promise<void> {
		const { threadId, isBusy, reason } = data;
		if (isBusy) {
			this.busyThreads.set(threadId, { isBusy: true, reason });
		} else {
			this.busyThreads.delete(threadId);
		}

		// Emit internal event for other main process services (e.g. TabService)
		emitter.emit("thread-busy-state-changed", data);

		// Trigger broadcast through broadcastService
		await broadcastService.broadcastToAll(_event, "thread-busy-state-changed", data);
	}

	/**
	 * Get current busy threads
	 */
	async getBusyThreads(
		_event: IpcMainInvokeEvent,
	): Promise<Record<string, { isBusy: boolean; reason?: string }>> {
		return Object.fromEntries(this.busyThreads);
	}

	/**
	 * Get all busy threads where code-agent config type is 'local'
	 */
	async getBusyLocalAgentThreads(_event: IpcMainInvokeEvent): Promise<string[]> {
		const threadIds = [...this.busyThreads.keys()];
		const configs = await Promise.all(
			threadIds.map(async (threadId) => ({
				threadId,
				...(await codeAgentStorage.getCodeAgentConfig(threadId)),
			})),
		);
		return configs
			.filter(({ isOK, data }) => isOK && data.type === "local")
			.map(({ threadId }) => threadId);
	}

	isThreadBusy(threadId: string): boolean {
		return this.busyThreads.has(threadId);
	}
}

export const threadStateService = new ThreadStateService();
