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

export const persistedTabState = new PersistedState<TabState>(
	"TabStorage:tab-bar-state",
	{} as TabState,
);

const { tabService, windowService } = window.electronAPI;

class TabBarState {
	private windowId = $state<string | null>(null);
	tabs = $derived<Tab[]>(
		this.windowId ? (persistedTabState.current[this.windowId]?.tabs ?? []) : [],
	);

	constructor() {
		this.initState();
	}

	private async initState() {
		this.windowId = await windowService.getWindowsId();
		console.log("this.windowId", this.windowId);
	}

	private newTab(tabId: string, type: TabType = "chat", active = true): Tab {
		const { title, getHref } = getTabConfig(type);

		return { id: tabId, title, href: getHref(tabId), type, active };
	}

	async handleTabClick(tab: Tab) {
		if (!this.windowId) return;

		const targetTab = this.tabs.find((t) => t.id === tab.id);
		if (!targetTab) return;

		const updatedTabs = this.tabs.map((t) => ({
			...t,
			active: t.id === tab.id,
		}));
		persistedTabState.current[this.windowId].tabs = updatedTabs;

		await tabService.handleActivateTab(tab.id);
	}

	handleTabClose(tab: Tab) {
		if (!this.windowId) return;

		const currentTabs = this.tabs;
		const targetIndex = currentTabs.findIndex((t) => t.id === tab.id);
		if (targetIndex === -1) return;

		const remainingTabs = currentTabs
			.filter((t) => t.id !== tab.id)
			.map((t, index, filteredTabs) => {
				if (tab.active && filteredTabs.length > 0) {
					const newActiveIndex = targetIndex > 0 ? targetIndex - 1 : 0;
					return { ...t, active: index === newActiveIndex };
				}
				return t;
			});

		persistedTabState.current[this.windowId].tabs = remainingTabs;
	}

	handleTabCloseAll() {
		if (!this.windowId) return;

		persistedTabState.current[this.windowId].tabs = [];
		setTimeout(() => {
			this.handleNewTab();
		}, 10);
	}

	async handleNewTab(type: TabType = "chat", active = true) {
		if (!this.windowId) return;

		const tabId = await tabService.handleNewTab();
		if (!tabId) return;

		const newTab = this.newTab(tabId, type, active);
		const updatedTabs = active
			? [...this.tabs.map((t) => ({ ...t, active: false })), newTab]
			: [...this.tabs, newTab];

		persistedTabState.current[this.windowId].tabs = updatedTabs;
	}

	updatePersistedTabs(tabs: Tab[]) {
		if (!this.windowId) return;
		persistedTabState.current[this.windowId].tabs = tabs;
	}
}

export const tabBarState = new TabBarState();
