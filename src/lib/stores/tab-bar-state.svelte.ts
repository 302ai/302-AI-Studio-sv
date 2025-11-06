import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import type { Tab, TabState, TabType } from "@shared/types";
import { isNull, isUndefined } from "es-toolkit/predicate";
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
	#isShellView = $state<boolean>(false);

	// Helper getter to always get the real current window ID
	// Safe to use in both shell views and tab views
	get currentWindowId(): string {
		return window.windowId;
	}

	// Helper method to get current window's tabs using real windowId
	// Safe to use in both shell views and tab views
	getCurrentWindowTabs(): Tab[] {
		return persistedTabState.current[this.currentWindowId]?.tabs ?? [];
	}

	tabs = $derived.by<Tab[]>(() => {
		// Only return tabs for shell views, tab views should not access tab bar state
		if (!this.#isShellView) {
			return [];
		}
		return persistedTabState.current[this.#windowId]?.tabs ?? [];
	});

	windowTabsInfo = $derived.by(() => {
		// Only return window info for shell views
		if (!this.#isShellView) {
			return [];
		}
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
		// Detect if this is a shell view (has TabBar) or a tab view (chat content)
		// Shell views have routes like /shell/123, tab views have routes like /chat/xxx
		this.#isShellView = window.location.pathname.startsWith("/shell");

		console.log(
			"TabBarState initialized - windowId:",
			this.#windowId,
			"isShellView:",
			this.#isShellView,
		);

		if (this.#isShellView) {
			console.log("Shell view tabs:", this.tabs);
		} else {
			console.log("Tab view - TabBarState disabled for this context");
		}

		// Listen for window ID changes when tab is moved between windows
		// Tab views need this to update window.windowId, but should NOT update TabBarState's #windowId
		window.addEventListener("windowIdChanged", (event: Event) => {
			const customEvent = event as CustomEvent<{ newWindowId: string }>;
			const { newWindowId } = customEvent.detail;

			if (this.#isShellView) {
				// Shell views should never be migrated, log warning if this happens
				console.warn(
					`[TabBarState] Unexpected windowId change in shell view from ${this.#windowId} to ${newWindowId}`,
				);
			} else {
				// Tab views are migrated between windows
				// Do NOT update #windowId to prevent this tab view's TabBarState from interfering
				console.log(
					`[TabBarState] Tab view migrated to window ${newWindowId}, keeping TabBarState disabled`,
				);
			}
			// CRITICAL: Do NOT update #windowId
			// This prevents migrated tab views from reading/writing other windows' tab state
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
		// This method can be called from both shell views and tab views
		// Only call backend - let sync update frontend state
		await tabService.handleActivateTab(tabId);
	}

	async handleTabClose(tabId: string) {
		// Only shell views should handle tab close
		if (!this.#isShellView) {
			console.warn("[TabBarState] handleTabClose called in tab view, ignoring");
			return;
		}

		if (!this.#windowId) return;

		const currentTabs = this.tabs;

		if (currentTabs.length > 1) {
			const newActiveTabId = await this.#handleTabRemovalWithActiveState(tabId);

			await tabService.handleTabClose(tabId, newActiveTabId);
		} else {
			persistedTabState.current[this.#windowId].tabs = [];
			console.log("handleTabClose: currentTabs.length === 1");

			setTimeout(() => {
				this.handleNewTab(m.title_new_chat());
			}, 100);
		}
	}

	async handleTabCloseOthers(tabId: string) {
		// Only shell views should handle tab operations
		if (!this.#isShellView) {
			console.warn("[TabBarState] handleTabCloseOthers called in tab view, ignoring");
			return;
		}

		const currentTabs = this.tabs;
		const targetTab = currentTabs.find((t) => t.id === tabId);
		if (isUndefined(targetTab)) return;

		const tabIdsToClose = currentTabs.filter((t) => t.id !== tabId).map((t) => t.id);
		const remainingTabs = [{ ...targetTab, active: true }];

		persistedTabState.current[this.#windowId].tabs = remainingTabs;

		await tabService.handleTabCloseOthers(tabId, tabIdsToClose);
	}

	async handleTabCloseOffside(tabId: string) {
		// Only shell views should handle tab operations
		if (!this.#isShellView) {
			console.warn("[TabBarState] handleTabCloseOffside called in tab view, ignoring");
			return;
		}

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

	async handleNewTab(title: string, type: TabType = "chat", active = true, href?: string) {
		// This method can be called from both shell views and tab views
		// Use real window.windowId to ensure correct behavior
		const currentWindowId = this.currentWindowId;
		const currentTabs = this.getCurrentWindowTabs();

		const shouldCreateNewTab = await match(type)
			.with("settings", async () => {
				const existingSettingsTab = currentTabs.find((tab) => tab.type === "settings");
				if (existingSettingsTab) {
					// Activate existing settings tab
					const updatedTabs = currentTabs.map((t) => ({
						...t,
						active: t.id === existingSettingsTab.id,
					}));
					persistedTabState.current[currentWindowId].tabs = updatedTabs;
					await tabService.handleActivateTab(existingSettingsTab.id);
					return false;
				}
				return true;
			})
			.with("chat", () => true)
			.with("aiApplications", () => true)
			.exhaustive();

		if (shouldCreateNewTab) {
			// Backend will create tab and update storage
			await tabService.handleNewTab(title, type, active, href);
			// Wait for PersistedState sync to update frontend
		}
	}

	async handleNewTabForExistingThread(threadId: string) {
		// This method can be called from both shell views and tab views
		// Use real window.windowId to ensure correct behavior regardless of context
		const currentWindowId = this.currentWindowId;

		console.log(
			`[TabBarState] handleNewTabForExistingThread: threadId=${threadId}, currentWindowId=${currentWindowId}`,
		);

		// Search in ALL windows (including current) to find if tab already exists
		const tabStateEntries = Object.entries(persistedTabState.current);
		for (const [windowId, windowTabs] of tabStateEntries) {
			if (!windowTabs) continue;

			const targetTab = windowTabs.tabs.find((tab) => tab.threadId === threadId);
			if (!targetTab) continue;

			// Found the tab!
			console.log(
				`[TabBarState] Found tab ${targetTab.id} in window ${windowId}, current window is ${currentWindowId}`,
			);

			if (windowId === currentWindowId) {
				// In current window - activate it
				console.log(`[TabBarState] Activating tab in current window`);
				await this.handleActivateTab(targetTab.id);
			} else {
				// In another window - focus that window and tab
				console.log(`[TabBarState] Focusing window ${windowId} with tab ${targetTab.id}`);
				await windowService.focusWindow(windowId, targetTab.id);
			}
			return;
		}

		// Thread doesn't exist in any tab - create a new tab in current window
		const threadData = await threadService.getThread(threadId);
		if (!threadData) return;

		// Backend will create tab and update storage
		await tabService.handleNewTabWithThread(threadId, threadData.thread.title, "chat", true);
		// Wait for PersistedState sync to update frontend
	}

	updatePersistedTabs(tabs: Tab[]) {
		// Only shell views should update tab state
		if (!this.#isShellView) {
			console.warn("[TabBarState] updatePersistedTabs called in tab view, ignoring");
			return;
		}

		persistedTabState.current[this.#windowId].tabs = tabs;
	}

	async handleTabOverlayChange(tabId: string, open: boolean) {
		// Only shell views should handle overlay changes
		if (!this.#isShellView) return;

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
		// Only shell views should handle overlay changes
		if (!this.#isShellView) return;

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
		// Only shell views should handle tab operations
		if (!this.#isShellView) {
			console.warn("[TabBarState] handleMoveTab called in tab view, ignoring");
			return;
		}

		await this.#handleTabRemovalWithActiveState(tabId);

		if (type === "existing-window" && targetWindowId) {
			await windowService.handleMoveTabIntoExistingWindow(tabId, targetWindowId);
		} else if (type === "new-window") {
			await windowService.handleSplitShellWindow(tabId);
		}
	}

	/**
	 * Remove a tab from the current window's state (for drag-to-detach/merge)
	 * This updates the frontend state after the backend has already moved the tab
	 */
	async handleTabRemovedByDrag(tabId: string) {
		// Only shell views should handle tab operations
		if (!this.#isShellView) {
			console.warn("[TabBarState] handleTabRemovedByDrag called in tab view, ignoring");
			return;
		}

		await this.#handleTabRemovalWithActiveState(tabId);
	}

	async updateTabTitle(threadId: string, title: string) {
		// This method can be called from both shell views and tab views
		// Use real window.windowId to ensure correct behavior
		const currentWindowId = this.currentWindowId;
		const currentTabs = this.getCurrentWindowTabs();

		const updatedTabs = currentTabs.map((tab) => {
			if (tab.threadId === threadId) {
				return { ...tab, title };
			}
			return tab;
		});

		// Use real windowId to ensure correct window is updated
		persistedTabState.current[currentWindowId].tabs = updatedTabs;
	}
}

export const tabBarState = new TabBarState();
