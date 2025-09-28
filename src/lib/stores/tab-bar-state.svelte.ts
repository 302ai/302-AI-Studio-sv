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
	readonly #windowId = $state<string>(window.windowId);
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

	async #handleTabRemovalWithActiveState(tabId: string): Promise<string | null> {
		const currentTabs = this.tabs;
		const targetTab = currentTabs.find((t) => t.id === tabId);
		if (!targetTab) return null;

		const isTargetTabActive = targetTab.active;
		let remainingTabs: Tab[];
		let newActiveTabId: string | null = null;

		if (isTargetTabActive) {
			// Find the removed tab index and create remaining tabs
			const remainingTabsList: Tab[] = [];
			let removedTabIndex = -1;

			currentTabs.forEach((tab, i) => {
				if (tab.id === tabId) {
					removedTabIndex = i;
				} else {
					remainingTabsList.push({ ...tab, active: false });
				}
			});

			if (remainingTabsList.length > 0) {
				// Select new active tab
				const newActiveIndex =
					removedTabIndex < remainingTabsList.length
						? removedTabIndex
						: remainingTabsList.length - 1;
				remainingTabsList[newActiveIndex].active = true;
				newActiveTabId = remainingTabsList[newActiveIndex].id;
			}

			remainingTabs = remainingTabsList;
		} else {
			remainingTabs = currentTabs.filter((t) => t.id !== tabId);
		}

		// Update persisted state
		persistedTabState.current[this.#windowId].tabs = remainingTabs;

		// Activate new tab if needed
		if (!isNull(newActiveTabId)) {
			await tabService.handleActivateTab(newActiveTabId);
		}

		return newActiveTabId;
	}

	// ******************************* Public Methods ******************************* //
	async handleActivateTab(tabId: string) {
		if (this.tabs.length === 1) return;
		const targetTab = this.tabs.find((t) => t.id === tabId);
		if (isUndefined(targetTab)) return;

		const updatedTabs = this.#setActiveTab(this.tabs, tabId);
		persistedTabState.current[this.#windowId].tabs = updatedTabs;

		await tabService.handleActivateTab(tabId);
	}

	async handleTabClose(tabId: string) {
		if (!this.#windowId) return;

		const newActiveTabId = await this.#handleTabRemovalWithActiveState(tabId);

		await tabService.handleTabClose(tabId, newActiveTabId);
	}

	async handleTabCloseOthers(tabId: string) {
		const currentTabs = this.tabs;
		const targetTab = currentTabs.find((t) => t.id === tabId);
		if (isUndefined(targetTab)) return;

		const tabIdsToClose = currentTabs.filter((t) => t.id !== tabId).map((t) => t.id);
		const remainingTabs = [{ ...targetTab, active: true }];

		persistedTabState.current[this.#windowId].tabs = remainingTabs;

		await tabService.handleTabCloseOthers(tabId, tabIdsToClose);
	}

	async handleTabCloseOffside(tabId: string) {
		const currentTabs = this.tabs;
		const targetIndex = currentTabs.findIndex((t) => t.id === tabId);
		if (targetIndex === -1) return;

		const tabsToClose = currentTabs.slice(targetIndex + 1);
		const tabIdsToClose = tabsToClose.map((t) => t.id);
		const remainingTabs = currentTabs.slice(0, targetIndex + 1);
		const activeTabIndex = currentTabs.findIndex((t) => t.active);
		const isActiveTabBeingClosed = activeTabIndex > targetIndex;

		const updatedTabs = isActiveTabBeingClosed
			? this.#setActiveTab(remainingTabs, tabId)
			: remainingTabs;

		const remainingTabIds = updatedTabs.map((t) => t.id);

		persistedTabState.current[this.#windowId].tabs = updatedTabs;

		await tabService.handleTabCloseOffside(
			tabId,
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

	async #createNewTab(title: string, type: TabType, active: boolean) {
		const unserializedTab = await tabService.handleNewTab(title, type, active);
		if (!unserializedTab) return;

		const tab = parse<Tab>(unserializedTab);
		const updatedTabs = active
			? [...this.tabs.map((t) => ({ ...t, active: false })), tab]
			: [...this.tabs, tab];

		persistedTabState.current[this.#windowId].tabs = updatedTabs;
	}

	async handleNewTab(title: string = "New Chat", type: TabType = "chat", active = true) {
		const shouldCreateNewTab = await match(type)
			.with("settings", async () => {
				const existingSettingsTab = this.tabs.find((tab) => tab.type === "settings");
				if (existingSettingsTab) {
					await this.handleActivateTab(existingSettingsTab.id);
					return false;
				}
				return true;
			})
			.with("chat", () => true)
			.with("302ai-tool", () => false)
			.exhaustive();

		if (shouldCreateNewTab) {
			await this.#createNewTab(title, type, active);
		}
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

	async handleMoveTab(
		tabId: string,
		type: "new-window" | "existing-window",
		targetWindowId?: string,
	) {
		await this.#handleTabRemovalWithActiveState(tabId);

		if (type === "existing-window" && targetWindowId) {
			await windowService.handleMoveTabIntoExistingWindow(tabId, targetWindowId);
		} else if (type === "new-window") {
			await windowService.handleSplitShellWindow(tabId);
		}
	}
}

export const tabBarState = new TabBarState();
