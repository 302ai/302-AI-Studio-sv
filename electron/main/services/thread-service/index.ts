import type { ThreadData } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import { threadStorage } from "../storage-service/thread-storage";

export class ThreadService {
	// 获取所有threads，已排序
	async getThreads(_event: IpcMainInvokeEvent): Promise<ThreadData[] | null> {
		try {
			return await threadStorage.getThreadsData();
		} catch (error) {
			console.error("ThreadService: Failed to get threads:", error);
			return null;
		}
	}

	// 切换收藏状态
	async toggleThreadFavorite(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			return await threadStorage.toggleFavorite(threadId);
		} catch (error) {
			console.error("ThreadService: Failed to toggle thread favorite:", error);
			return false;
		}
	}

	// 添加thread到列表
	async addThread(_event: IpcMainInvokeEvent, threadId: string): Promise<void> {
		try {
			await threadStorage.addThread(threadId);
		} catch (error) {
			console.error("ThreadService: Failed to add thread:", error);
		}
	}

	// 从列表中移除thread
	async removeThread(_event: IpcMainInvokeEvent, threadId: string): Promise<void> {
		try {
			await threadStorage.removeThread(threadId);
		} catch (error) {
			console.error("ThreadService: Failed to remove thread:", error);
		}
	}

	// 检查是否收藏
	async isFavorite(_event: IpcMainInvokeEvent, threadId: string): Promise<boolean> {
		try {
			return await threadStorage.isFavorite(threadId);
		} catch (error) {
			console.error("ThreadService: Failed to check favorite status:", error);
			return false;
		}
	}
}

export const threadService = new ThreadService();
