import type { ThreadData } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { threadStorage } from "../storage-service/thread-storage";

export class ThreadService {
	async addThread(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			await threadStorage.addThread(threadId);
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to add thread:", error);
			return false;
		}
	}

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

	async renameThread(
		_event: IpcMainInvokeEvent,
		threadId: string,
		newName: string,
	): Promise<boolean> {
		try {
			await threadStorage.renameThread(threadId, newName);
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to rename thread:", error);
			return false;
		}
	}

	async addFavorite(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			await threadStorage.addFavorite(threadId);
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to add favorite:", error);
			return false;
		}
	}

	async removeFavorite(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			await threadStorage.removeFavorite(threadId);
			return true;
		} catch (error) {
			console.error("ThreadService: Failed to remove favorite:", error);
			return false;
		}
	}
}

export const threadService = new ThreadService();
