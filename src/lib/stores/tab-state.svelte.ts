import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Tab, TabState, TabType } from "@shared/types";

type TabConfig = {
	title: string;
	getHref: (id: string) => string;
};

const TAB_CONFIGS: Record<TabType, TabConfig> = {
	chat: { title: "New Chat", getHref: (id) => `/chat/${id}` },
	settings: { title: "Settings", getHref: () => "/settings/general-settings" },
	"302ai-tool": { title: "302AI Tool", getHref: (id) => `/tool/${id}` },
} as const;

const getTabConfig = (type: TabType) => TAB_CONFIGS[type] || TAB_CONFIGS.chat;

export const persistedTabState = new PersistedState<TabState>("TabStorage:tabs", []);

const { tabService } = window.electronAPI;

class TabBarState {
	private newTab(tabId: string, type: TabType = "chat") {
		const { title, getHref } = getTabConfig(type);

		return { id: tabId, title, href: getHref(tabId), type };
	}

	handleTabClick(tab: Tab) {
		persistedActiveTabId.current = tab.id;
	}

	handleTabClose(tab: Tab) {
		const currentTabs = persistedTabs.current;
		const targetIndex = currentTabs.findIndex((t) => t.id === tab.id);
		if (targetIndex === -1) return;

		const remainingTabs = currentTabs.filter((t) => t.id !== tab.id);
		persistedTabs.current = remainingTabs;

		if (persistedActiveTabId.current === tab.id && remainingTabs.length > 0) {
			const newIndex = Math.min(targetIndex, remainingTabs.length - 1);
			const newTab = remainingTabs[newIndex];
			persistedActiveTabId.current = newTab.id;
		}
	}

	handleTabCloseAll() {
		persistedTabs.current = [];
		setTimeout(() => {
			this.handleNewTab();
		}, 10);
	}

	async handleNewTab(type: TabType = "chat") {
		const tabId = await tabService.handleNewTab();
		if (!tabId) return;

		const tab = this.newTab(tabId, type);
		persistedTabs.current = [...persistedTabs.current, tab];
		persistedActiveTabId.current = tab.id;
	}
}

export const tabBarState = new TabBarState();
