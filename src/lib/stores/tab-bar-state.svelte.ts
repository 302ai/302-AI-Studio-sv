import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import type { Tab, TabState, TabType } from "@shared/types";
import { isNull, isUndefined } from "es-toolkit/predicate";
import { parse } from "superjson";
import { match } from "ts-pattern";

export const persistedTabState = new PersistedState<TabState>(
	"TabStorage:tab-bar-state",
	{} as TabState,
);

const { tabService, windowService, threadService } = window.electronAPI;

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
		console.log("tabs", this.tabs);

		// Listen for window ID changes when tab is moved between windows
		window.addEventListener("windowIdChanged", (event: Event) => {
			const customEvent = event as CustomEvent<{ newWindowId: string }>;
			const { newWindowId } = customEvent.detail;
			console.log(`Window ID changed from ${this.#windowId} to ${newWindowId}`);
			this.#windowId = newWindowId;
		});
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
		const currentWindowId = this.#windowId;
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

		if (remainingTabs.length > 0) {
			persistedTabState.current[currentWindowId].tabs = remainingTabs;
		}

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

		const currentTabs = this.tabs;

		if (currentTabs.length > 1) {
			const newActiveTabId = await this.#handleTabRemovalWithActiveState(tabId);

			await tabService.handleTabClose(tabId, newActiveTabId);
		} else {
			persistedTabState.current[this.#windowId].tabs = [];
			console.log("handleTabClose: currentTabs.length === 1");

			this.handleNewTab(m.title_new_chat());
		}
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

		this.handleNewTab(m.title_new_chat());
	}

	async #createNewTab(title: string, type: TabType, active: boolean, href?: string) {
		const unserializedTab = await tabService.handleNewTab(title, type, active, href);
		if (!unserializedTab) return;

		const tab = parse<Tab>(unserializedTab);
		const updatedTabs = active
			? [...this.tabs.map((t) => ({ ...t, active: false })), tab]
			: [...this.tabs, tab];

		persistedTabState.current[this.#windowId].tabs = updatedTabs;
	}

	async handleNewTab(title: string, type: TabType = "chat", active = true, href?: string) {
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
			.with("aiApplications", () => true)
			.exhaustive();

		if (shouldCreateNewTab) {
			await this.#createNewTab(title, type, active, href);
		}
	}

	async handleNewTabForExistingThread(threadId: string) {
		// Case 1: Check if thread exists in current window's tabs
		const existingTabInCurrentWindow = this.tabs.find((tab) => tab.threadId === threadId);
		if (existingTabInCurrentWindow) {
			await this.handleActivateTab(existingTabInCurrentWindow.id);
			return;
		}

		// Case 2: Check if thread exists in other windows
		const tabStateEntries = Object.entries(persistedTabState.current);
		if (tabStateEntries.length > 1) {
			for (const [windowId, windowTabs] of tabStateEntries) {
				if (windowId === this.#windowId) continue;
				if (!windowTabs) continue;

				const targetTab = windowTabs.tabs.find((tab) => tab.threadId === threadId);
				if (!targetTab) continue;

				// Found in another window - focus that window and tab
				const updatedTabs = windowTabs.tabs.map((tab) => ({
					...tab,
					active: tab.id === targetTab.id,
				}));
				persistedTabState.current[windowId].tabs = updatedTabs;

				await windowService.focusWindow(windowId, targetTab.id);
				return;
			}
		}

		// Case 3: Thread doesn't exist in any tab - replace current active tab's content
		const activeTab = this.tabs.find((tab) => tab.active);
		if (activeTab) {
			console.log(
				`[handleNewTabForExistingThread] Replacing active tab ${activeTab.id} with thread ${threadId}`,
			);

			// Get thread data first to update tab title
			const threadData = await threadService.getThread(threadId);
			if (!threadData) return;

			// Update persisted tabs BEFORE calling replaceTabContent to avoid UI flicker
			const updatedTabs = this.tabs.map((tab) =>
				tab.id === activeTab.id ? { ...tab, threadId, title: threadData.thread.title } : tab,
			);
			this.updatePersistedTabs(updatedTabs);

			// Call main process to replace the view
			const success = await tabService.replaceTabContent(activeTab.id, threadId);
			console.log(`[handleNewTabForExistingThread] Replace result: ${success}`);

			if (!success) {
				// If failed, revert the tab changes
				this.updatePersistedTabs(this.tabs);
			}
			return;
		}

		// Fallback: create new tab if no active tab exists
		const threadData = await threadService.getThread(threadId);
		if (!threadData) return;

		const unserializedTab = await tabService.handleNewTabWithThread(
			threadId,
			threadData.thread.title,
			"chat",
			true,
		);
		if (!unserializedTab) return;

		const newTab = parse<Tab>(unserializedTab);
		const updatedTabs = [...this.tabs.map((t) => ({ ...t, active: false })), newTab];

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

	async updateTabTitle(threadId: string, title: string) {
		const updatedTabs = this.tabs.map((tab) => {
			if (tab.threadId === threadId) {
				return { ...tab, title };
			}
			return tab;
		});
		this.updatePersistedTabs(updatedTabs);
	}
}

export const tabBarState = new TabBarState();
