import { prefixStorage, TabState, type Tab, type ThreadParmas } from "@shared/types";
import { isNull } from "es-toolkit";
import { isEmpty } from "es-toolkit/compat";
import { nanoid } from "nanoid";
import { storageService, StorageService } from ".";
import { generalSettingsService } from "../settings-service";

export class TabStorage extends StorageService<TabState> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "TabStorage");
	}

	/**
	 * Validate if thread file has valid JSON format
	 * - If thread file doesn't exist: valid (returns true)
	 * - If thread file exists but has invalid JSON: invalid (returns false)
	 * @param threadId - The thread ID to validate
	 * @returns true if thread is valid or doesn't exist, false if JSON is corrupted
	 */
	private async validateThreadData(threadId: string): Promise<boolean> {
		try {
			const threadKey = "app-thread:" + threadId;
			const hasFile = await storageService.hasItemInternal(threadKey);

			// If file doesn't exist, it's considered valid (allow this tab)
			if (!hasFile) {
				return true;
			}

			// If file exists, try to parse it to ensure JSON format is valid
			const threadData = await storageService.getItemInternal(threadKey);
			// If parsing succeeds, data is valid
			return !isNull(threadData) && !isEmpty(threadData);
		} catch (error) {
			// If we get a JSON parsing error, the file is corrupted
			if (error instanceof SyntaxError) {
				console.error(`Thread ${threadId} has corrupted JSON format: ${error.message}`);
				return false;
			}
			// Other errors (file access, etc.) are also treated as invalid
			console.error(`Failed to validate thread ${threadId}:`, error);
			return false;
		}
	}

	async getTabsByWindowId(windowId: string): Promise<Tab[] | null> {
		const result = await this.getItemInternal("tab-bar-state");
		return result ? result[windowId].tabs : null;
	}

	async getAllTabs(): Promise<Tab[] | null> {
		const result = await this.getItemInternal("tab-bar-state");
		return result ? Object.values(result).flatMap((windowTabs) => windowTabs.tabs) : null;
	}

	async getActiveTabId(windowId: string): Promise<string | null> {
		const result = await this.getItemInternal("tab-bar-state");
		if (!result) return null;

		const activeTabId = result[windowId].tabs.find((t) => t.active)?.id;
		return activeTabId ?? null;
	}

	async getAllWindowsTabs(): Promise<Tab[][] | null> {
		const allWindowsTabs: Tab[][] = [];

		const result = await this.getItemInternal("tab-bar-state");
		if (isNull(result) || isEmpty(result)) {
			const language = await generalSettingsService.getLanguage();
			const title = language === "zh" ? "新会话" : "New Chat";
			const tabId = nanoid();
			const threadId = nanoid();
			const initTab: Tab = {
				id: tabId,
				title,
				href: `/chat/${tabId}`,
				type: "chat",
				active: true,
				threadId,
			};
			const initThread: ThreadParmas = {
				id: threadId,
				title,
				temperature: null,
				topP: null,
				frequencyPenalty: null,
				presencePenalty: null,
				maxTokens: null,
				inputValue: "",
				attachments: [],
				mcpServers: [],
				mcpServerIds: [],
				isThinkingActive: false,
				isOnlineSearchActive: false,
				isMCPActive: false,
				selectedModel: null,
				isPrivateChatActive: false,
				updatedAt: new Date(),
			};
			allWindowsTabs.push([initTab]);

			await this.setItemInternal("tab-bar-state", {
				"1": {
					tabs: [initTab],
				},
			});
			await storageService.setItemInternal("app-thread:" + initTab.threadId, initThread);
			await storageService.setItemInternal("app-chat-messages:" + initTab.threadId, []);
		} else {
			for (const windowTabs of Object.values(result)) {
				const validTabs: Tab[] = [];

				for (const tab of windowTabs.tabs) {
					const isThreadValid = await this.validateThreadData(tab.threadId);
					if (isThreadValid) {
						validTabs.push(tab);
					}
				}

				allWindowsTabs.push(validTabs);
			}
		}

		return allWindowsTabs;
	}

	async initWindowMapping(newWindowIds: number[], windowsTabsArray: Tab[][]): Promise<void> {
		const newTabState: TabState = {};

		newWindowIds.forEach((windowId, index) => {
			const tabs = windowsTabsArray[index];
			if (tabs) {
				newTabState[windowId.toString()] = {
					tabs,
				};
			}
		});

		await this.setItemInternal("tab-bar-state", newTabState);
	}

	async updateWindowTabs(windowId: string, tabs: Tab[]) {
		const tabState = await this.getItemInternal("tab-bar-state");
		if (isNull(tabState)) return;
		tabState[windowId] ??= { tabs: [] };
		tabState[windowId].tabs = tabs;
		await this.setItemInternal("tab-bar-state", tabState);
	}

	async removeWindowState(windowId: string) {
		const tabState = await this.getItemInternal("tab-bar-state");
		if (isNull(tabState)) return;
		delete tabState[windowId];
		await this.setItemInternal("tab-bar-state", tabState);
	}

	async getPersistedTabState(): Promise<TabState | null> {
		return this.getItemInternal("tab-bar-state");
	}
}

export const tabStorage = new TabStorage();
