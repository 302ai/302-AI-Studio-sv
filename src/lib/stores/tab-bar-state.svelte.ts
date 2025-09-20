import { goto } from "$app/navigation";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Tab, TabType } from "@shared/types";
import { nanoid } from "nanoid";

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

export function newTab(type: TabType = "chat"): Tab {
	const id = nanoid();
	const { title, getHref } = getTabConfig(type);

	return { id, title, href: getHref(id), type };
}

export const persistedTabs = new PersistedState<Tab[]>("app-tab-state", [newTab()]);
export const persistedActiveTabId = new PersistedState<string>("app-active-tab-id", "");

class TabBarState {
	handleTabClick(tab: Tab) {
		persistedActiveTabId.current = tab.id;
		goto(tab.href);
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
			goto(newTab.href);
		}
	}

	handleTabCloseAll() {
		persistedTabs.current = [];
		setTimeout(() => {
			this.handleNewTab();
		}, 10);
	}

	handleNewTab(type: TabType = "chat") {
		const tab = newTab(type);
		persistedTabs.current = [...persistedTabs.current, tab];
		persistedActiveTabId.current = tab.id;
		goto(tab.href);
	}
}

export const tabBarState = new TabBarState();
