import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { Tab, TabState, TabType } from "@shared/types";
import { isNull, isUndefined } from "es-toolkit/predicate";
import { parse } from "superjson";
import { match } from "ts-pattern";

export const persistedTabState = new PersistedState<TabState>(
	"TabStorage:tab-bar-state",
	{} as TabState,
);

const { tabService, windowService } = window.electronAPI;

class TabBarState {
	#windowId = $state<string>(window.windowId);
	#activeOverlayId = $state<string | null>(null);
	#isShellViewElevated = $state<boolean>(false);

	tabs = $derived<Tab[]>(persistedTabState.current[this.#windowId]?.tabs ?? []);
	windowTabsInfo = $derived.by(() => {
		const windowIds = Object.keys(persistedTabState.current);
		return windowIds
			.filter((id) => id !== this.#windowId)
			.map((windowId) => {
				const tabs = persistedTabState.current[windowId].tabs;
				return {
					windowId,
					tabs,
					firstTabTitle: tabs[0].title,
				};
			});
	});

	constructor() {
		console.log("windowId", this.#windowId);
	}

	// ******************************* Private Methods ******************************* //
	#setActiveTab(tabs: Tab[], activeTabId: string): Tab[] {
		return tabs.map((t) => ({
			...t,
			active: t.id === activeTabId,
		}));
	}

	#selectNewActiveTabAfterRemoval(
		tabs: Tab[],
		removedTabIndex: number,
		removedTabId: string,
	): Tab[] {
		const remainingTabs = tabs.filter((t) => t.id !== removedTabId);
		if (remainingTabs.length === 0) return remainingTabs;

		const newActiveIndex =
			removedTabIndex < remainingTabs.length ? removedTabIndex : remainingTabs.length - 1;
		return remainingTabs.map((t, index) => ({
			...t,
			active: index === newActiveIndex,
		}));
	}

	// ******************************* Public Methods ******************************* //
	async handleTabClick(tab: Tab) {
		if (this.tabs.length === 1) return;
		const targetTab = this.tabs.find((t) => t.id === tab.id);
		if (isUndefined(targetTab)) return;

		const updatedTabs = this.#setActiveTab(this.tabs, tab.id);
		persistedTabState.current[this.#windowId].tabs = updatedTabs;

		await tabService.handleActivateTab(tab.id);
	}

	async handleTabClose(tab: Tab) {
		if (!this.#windowId) return;

		const currentTabs = this.tabs;
		const targetIndex = currentTabs.findIndex((t) => t.id === tab.id);
		if (targetIndex === -1) return;

		let remainingTabs: Tab[];
		let newActiveTabId: string | null = null;

		if (tab.active) {
			remainingTabs = this.#selectNewActiveTabAfterRemoval(currentTabs, targetIndex, tab.id);
			if (remainingTabs.length > 0) {
				const newActiveTab = remainingTabs.find((t) => t.active);
				newActiveTabId = newActiveTab?.id ?? null;
			}
		} else {
			remainingTabs = currentTabs.filter((t) => t.id !== tab.id);
		}

		persistedTabState.current[this.#windowId].tabs = remainingTabs;

		await tabService.handleTabClose(tab.id, newActiveTabId);
	}

	async handleTabCloseOthers(tab: Tab) {
		const currentTabs = this.tabs;
		const targetTab = currentTabs.find((t) => t.id === tab.id);
		if (isUndefined(targetTab)) return;

		const tabIdsToClose = currentTabs.filter((t) => t.id !== tab.id).map((t) => t.id);
		const remainingTabs = [{ ...targetTab, active: true }];

		persistedTabState.current[this.#windowId].tabs = remainingTabs;

		await tabService.handleTabCloseOthers(tab.id, tabIdsToClose);
	}

	async handleTabCloseOffside(tab: Tab) {
		const currentTabs = this.tabs;
		const targetIndex = currentTabs.findIndex((t) => t.id === tab.id);
		if (targetIndex === -1) return;

		const tabsToClose = currentTabs.slice(targetIndex + 1);
		const tabIdsToClose = tabsToClose.map((t) => t.id);
		const remainingTabs = currentTabs.slice(0, targetIndex + 1);
		const activeTabIndex = currentTabs.findIndex((t) => t.active);
		const isActiveTabBeingClosed = activeTabIndex > targetIndex;

		const updatedTabs = isActiveTabBeingClosed
			? this.#setActiveTab(remainingTabs, tab.id)
			: remainingTabs;

		const remainingTabIds = updatedTabs.map((t) => t.id);

		persistedTabState.current[this.#windowId].tabs = updatedTabs;

		await tabService.handleTabCloseOffside(
			tab.id,
			tabIdsToClose,
			remainingTabIds,
			isActiveTabBeingClosed,
		);
	}

	async handleTabCloseAll() {
		persistedTabState.current[this.#windowId].tabs = [];

		await tabService.handleTabCloseAll();

		setTimeout(() => {
			this.handleNewTab();
		}, 10);
	}

	async handleNewTab(title: string = "New Chat", type: TabType = "chat", active = true) {
		const unserializedTab = await tabService.handleNewTab(title, type, active);
		if (!unserializedTab) return;

		const tab = parse<Tab>(unserializedTab);
		const updatedTabs = active
			? [...this.tabs.map((t) => ({ ...t, active: false })), tab]
			: [...this.tabs, tab];

		persistedTabState.current[this.#windowId].tabs = updatedTabs;
	}

	updatePersistedTabs(tabs: Tab[]) {
		persistedTabState.current[this.#windowId].tabs = tabs;
	}

	async handleTabOverlayChange(tabId: string, open: boolean) {
		if (open) {
			if (!isNull(this.#activeOverlayId) && this.#activeOverlayId !== tabId) {
				this.#activeOverlayId = tabId;
			} else if (isNull(this.#activeOverlayId)) {
				this.#activeOverlayId = tabId;
				if (!this.#isShellViewElevated) {
					this.#isShellViewElevated = true;
					await tabService.handleShellViewLevel(true);
				}
			}
		} else {
			if (this.#activeOverlayId === tabId) {
				this.#activeOverlayId = null;
				if (this.#isShellViewElevated) {
					this.#isShellViewElevated = false;
					await tabService.handleShellViewLevel(false);
				}
			}
		}
	}

	async handleGeneralOverlayChange(open: boolean) {
		await match({
			open,
			isElevated: this.#isShellViewElevated,
			hasActiveOverlay: !isNull(this.#activeOverlayId),
		})
			.with({ open: true, isElevated: false }, async () => {
				this.#isShellViewElevated = true;
				await tabService.handleShellViewLevel(true);
			})
			.with({ open: true, isElevated: true }, () => {})
			.with({ open: false, isElevated: true, hasActiveOverlay: false }, async () => {
				this.#isShellViewElevated = false;
				await tabService.handleShellViewLevel(false);
			})
			.with({ open: false }, () => {})
			.exhaustive();
	}

	async handleMoveTabIntoNewWindow(tabId: string) {
		const currentTabs = this.tabs;
		const targetIndex = currentTabs.findIndex((t) => t.id === tabId);
		if (targetIndex === -1) return;

		const targetTab = currentTabs[targetIndex];
		const isTargetTabActive = targetTab.active;

		let remainingTabs: Tab[];

		if (isTargetTabActive && currentTabs.length > 1) {
			remainingTabs = this.#selectNewActiveTabAfterRemoval(currentTabs, targetIndex, tabId);
		} else {
			remainingTabs = currentTabs.filter((t) => t.id !== tabId);
		}

		persistedTabState.current[this.#windowId].tabs = remainingTabs;

		await windowService.handleSplitShellWindow(tabId);
	}
}

export const tabBarState = new TabBarState();
