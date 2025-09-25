import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Tab, TabState, TabType } from "@shared/types";
import { isNull } from "es-toolkit/predicate";
import { match } from "ts-pattern";

export const persistedTabState = new PersistedState<TabState>(
	"TabStorage:tab-bar-state",
	{} as TabState,
);

const { tabService } = window.electronAPI;

class TabBarState {
	private windowId = $state<string>(window.windowId);
	tabs = $derived<Tab[]>(persistedTabState.current[this.windowId]?.tabs ?? []);

	// Shell view level management for context menus and tooltips
	private activeOverlayId = $state<string | null>(null);
	private isShellViewElevated = $state<boolean>(false);

	constructor() {
		console.log("windowId", this.windowId);
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

	async handleTabClose(tab: Tab) {
		if (!this.windowId) return;

		const currentTabs = this.tabs;
		const targetIndex = currentTabs.findIndex((t) => t.id === tab.id);
		if (targetIndex === -1) return;

		let newActiveTabId: string | null = null;

		const remainingTabs = currentTabs
			.filter((t) => t.id !== tab.id)
			.map((t, index, filteredTabs) => {
				if (tab.active && filteredTabs.length > 0) {
					const newActiveIndex = targetIndex > 0 ? targetIndex - 1 : 0;
					newActiveTabId = filteredTabs[newActiveIndex].id;
					return { ...t, active: index === newActiveIndex };
				}
				return t;
			});

		persistedTabState.current[this.windowId].tabs = remainingTabs;

		await tabService.handleTabClose(tab.id, newActiveTabId);
	}

	async handleTabCloseAll() {
		if (!this.windowId) return;

		persistedTabState.current[this.windowId].tabs = [];

		await tabService.handleTabCloseAll();

		setTimeout(() => {
			this.handleNewTab();
		}, 10);
	}

	async handleNewTab(title: string = "New Chat", type: TabType = "chat", active = true) {
		if (!this.windowId) return;

		const unserializedTab = await tabService.handleNewTab(title, type, active);
		if (!unserializedTab) return;

		const tab = JSON.parse(unserializedTab);
		const updatedTabs = active
			? [...this.tabs.map((t) => ({ ...t, active: false })), tab]
			: [...this.tabs, tab];

		persistedTabState.current[this.windowId].tabs = updatedTabs;
	}

	updatePersistedTabs(tabs: Tab[]) {
		if (!this.windowId) return;
		persistedTabState.current[this.windowId].tabs = tabs;
	}

	async handleTabOverlayChange(tabId: string, open: boolean) {
		if (open) {
			if (!isNull(this.activeOverlayId) && this.activeOverlayId !== tabId) {
				this.activeOverlayId = tabId;
			} else if (isNull(this.activeOverlayId)) {
				this.activeOverlayId = tabId;
				if (!this.isShellViewElevated) {
					this.isShellViewElevated = true;
					await tabService.handleShellViewLevel(true);
				}
			}
		} else {
			if (this.activeOverlayId === tabId) {
				this.activeOverlayId = null;
				if (this.isShellViewElevated) {
					this.isShellViewElevated = false;
					await tabService.handleShellViewLevel(false);
				}
			}
		}
	}

	async handleGeneralOverlayChange(open: boolean) {
		await match({
			open,
			isElevated: this.isShellViewElevated,
			hasActiveOverlay: !isNull(this.activeOverlayId),
		})
			.with({ open: true, isElevated: false }, async () => {
				this.isShellViewElevated = true;
				await tabService.handleShellViewLevel(true);
			})
			.with({ open: true, isElevated: true }, () => {})
			.with({ open: false, isElevated: true, hasActiveOverlay: false }, async () => {
				this.isShellViewElevated = false;
				await tabService.handleShellViewLevel(false);
			})
			.with({ open: false }, () => {})
			.exhaustive();
	}
}

export const tabBarState = new TabBarState();
