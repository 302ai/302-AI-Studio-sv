import type { ThreadData } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { threadStorage } from "../storage-service/thread-storage";

export class ThreadService {
	async getThreads(_event: IpcMainInvokeEvent): Promise<ThreadData[] | null> {
		try {
			return await threadStorage.getThreadsData();
		} catch (error) {
			console.error("ThreadService: Failed to get threads:", error);
			return null;
		}
	}

	async getThread(_event: IpcMainInvokeEvent, threadId: string): Promise<ThreadData | null> {
		try {
			return await threadStorage.getThread(threadId);
		} catch (error) {
			console.error("ThreadService: Failed to get thread:", error);
			return null;
		}
	}

	async deleteThread(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			await threadStorage.deleteThread(threadId);
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to delete thread:", error);
			return false;
		}
	}
}

export const threadService = new ThreadService();
