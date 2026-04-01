import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import { MAX_TABS_PER_WINDOW, NEW_TAB_THROTTLE_MS } from "@shared/constants/tab";
import type { Tab, TabState, TabType } from "@shared/types";
import { throttle } from "es-toolkit";
import { isNull, isUndefined } from "es-toolkit/predicate";
import { match } from "ts-pattern";

export const persistedTabState = new PersistedState<TabState>(
	"TabStorage:tab-bar-state",
	{} as TabState,
);

$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedTabState.current;
	});
});
const { tabService, windowService, threadService, broadcastService } = window.electronAPI;

class TabBarState {
	#windowId = $state<string>(window.windowId);
	#activeOverlayId = $state<string | null>(null);
	#isShellViewElevated = $state<boolean>(false);
	#isShellView = $state<boolean>(false);
	#fallbackTabCreationInFlight = false;
	#lastFallbackAttemptAt = 0;

	get currentWindowId(): string {
		return this.#windowId;
	}

	async getCurrentWindowTabs(): Promise<Tab[]> {
		return (await tabService.getAllTabsForCurrentWindow()) ?? [];
	}

	async getAllTabs(): Promise<Tab[]> {
		return (await tabService.getAllTabs()) ?? [];
	}

	tabs = $derived.by<Tab[]>(() => {
		// Only return tabs for shell views, tab views should not access tab bar state
		if (!this.#isShellView) {
			return [];
		}

		const current = persistedTabState.current;
		// Guard against null state during cross-window sync
		if (!current) return [];

		const _persistedTabState = current[this.#windowId];
		return _persistedTabState?.tabs ?? [];
	});

	windowTabsInfo = $derived.by(() => {
		// Only return window info for shell views
		if (!this.#isShellView) {
			return [];
		}
		const current = persistedTabState.current;
		// Guard against null state during cross-window sync
		if (!current) return [];

		const windowIds = Object.keys(current);
		return windowIds
			.filter((id) => id !== this.#windowId)
			.map((windowId) => {
				const windowState = current[windowId];
				if (!windowState || !windowState.tabs || windowState.tabs.length === 0) {
					return null;
				}
				const tabs = windowState.tabs;
				return {
					windowId,
					tabs,
					firstTabTitle: tabs[0].title,
				};
			})
			.filter((item): item is NonNullable<typeof item> => item !== null);
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

		// Fallback: if external actions (e.g. "delete all sessions for account") remove ALL tabs,
		// ensure the shell window always has at least one tab.
		//
		// We only do this:
		// - in shell views (tab views must not manage tab state)
		// - after PersistedState hydration (avoid creating tabs during boot)
		// - with a small debounce + backend re-check (avoid duplicate tabs during async sync)
		if (this.#isShellView) {
			$effect.root(() => {
				$effect(() => {
					if (!persistedTabState.isHydrated) return;
					if (!this.#windowId) return;

					const current = persistedTabState.current;
					const tabs = current?.[this.#windowId]?.tabs ?? [];
					if (tabs.length > 0) return;

					const now = Date.now();
					if (this.#fallbackTabCreationInFlight) return;
					if (now - this.#lastFallbackAttemptAt < 800) return;

					this.#fallbackTabCreationInFlight = true;
					this.#lastFallbackAttemptAt = now;

					setTimeout(async () => {
						try {
							// Re-check backend state to avoid creating duplicates due to sync lag
							const backendTabs = await this.getCurrentWindowTabs();
							if ((backendTabs?.length ?? 0) === 0) {
								await this.#doHandleNewTab(m.title_new_chat());
								// Ensure UI reflects the backend-created tab immediately even if
								// cross-process sync is delayed or missed.
								await persistedTabState.refresh();
							}
						} finally {
							this.#fallbackTabCreationInFlight = false;
						}
					}, 0);
				});
			});
		}

		window.addEventListener("windowIdChanged", (event: Event) => {
			const customEvent = event as CustomEvent<{ newWindowId: string }>;
			const { newWindowId } = customEvent.detail;
			console.log(`Window ID changed from ${this.#windowId} to ${newWindowId}`);
			this.#windowId = newWindowId;
		});
	}

	// ******************************* Private Methods ******************************* //
	#safeUpdateWindowTabs(windowId: string, tabs: Tab[]): void {
		persistedTabState.current = {
			...persistedTabState.current,
			[windowId]: { tabs },
		};
	}

	#setActiveTab(tabs: Tab[], activeTabId: string): Tab[] {
		return tabs.map((t) => ({
			...t,
			active: t.id === activeTabId,
		}));
	}

	get activeTab() {
		return persistedTabState.current[this.#windowId]?.tabs.find((t) => t.active);
	}

	async #handleTabRemovalWithActiveState(
		tabId: string,
		currentTabs: Tab[],
	): Promise<string | null> {
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
			this.#safeUpdateWindowTabs(this.#windowId, remainingTabs);
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
		try {
			if (!this.#windowId) return;

			const currentTabs = this.#isShellView ? this.tabs : await this.getCurrentWindowTabs();

			if (currentTabs.length > 1) {
				const newActiveTabId = await this.#handleTabRemovalWithActiveState(
					tabId,
					currentTabs,
				);

				// Ensure storage is written before the IPC call destroys the WebContentsView.
				// In tab views, #safeUpdateWindowTabs fires an async storage write that may not
				// complete before tabService.handleTabClose destroys the view.
				if (!this.#isShellView) {
					await persistedTabState.flush();
				}

				await tabService.handleTabClose(tabId, newActiveTabId);
			} else {
				// Clear tabs - the $effect fallback will create a new tab
				// We don't create explicitly to avoid race conditions with the reactive system
				this.#safeUpdateWindowTabs(this.#windowId, []);

				// Also close the backend tab view
				await tabService.handleTabClose(tabId, null);
			}
		} catch (e) {
			console.warn(e);
		} finally {
			await broadcastService.broadcastToAll("thread-list-updated", {});
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

		this.#safeUpdateWindowTabs(this.#windowId, remainingTabs);

		await tabService.handleTabCloseOthers(tabId, tabIdsToClose);

		await broadcastService.broadcastToAll("thread-list-updated", {});
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

		this.#safeUpdateWindowTabs(this.#windowId, updatedTabs);

		await tabService.handleTabCloseOffside(
			tabId,
			tabIdsToClose,
			remainingTabIds,
			isActiveTabBeingClosed,
		);
	}

	handleNewTab = throttle(
		(
			title: string,
			type: TabType = "chat",
			active = true,
			href?: string,
			content?: string,
			previewId?: string,
		) => {
			this.#doHandleNewTab(title, type, active, href, content, previewId);
		},
		NEW_TAB_THROTTLE_MS,
		{ edges: ["leading"] },
	);

	async #doHandleNewTab(
		title: string,
		type: TabType = "chat",
		active = true,
		href?: string,
		content?: string,
		previewId?: string,
	) {
		// This method can be called from both shell views and tab views
		// Use real window.windowId to ensure correct behavior
		const currentWindowId = this.currentWindowId;
		const currentTabs = await this.getCurrentWindowTabs();

		// Tab limit check
		if (currentTabs.length >= MAX_TABS_PER_WINDOW) {
			const activeThreadId = currentTabs.find((t) => t.active)?.threadId;
			broadcastService.broadcastToAll("show-toast", {
				type: "warning",
				message: m.toast_tab_limit_reached(),
				threadId: activeThreadId,
			});
			return;
		}

		const shouldCreateNewTab = await match(type)
			.with("settings", async () => {
				const existingSettingsTab = currentTabs?.find((tab) => tab.type === "settings");
				if (existingSettingsTab) {
					// Activate existing settings tab
					const updatedTabs = currentTabs?.map((t) => ({
						...t,
						active: t.id === existingSettingsTab.id,
					}));
					this.#safeUpdateWindowTabs(currentWindowId, updatedTabs ?? []);
					await tabService.handleActivateTab(existingSettingsTab.id);
					return false;
				}
				return true;
			})
			.with("helpDocs", () => true)
			.with("skillsHub", () => true)
			.with("chat", () => true)
			.with("aiApplications", () => true)
			.with("codeAgent", () => true)
			.with("openClawWebUi", async () => {
				const existingOpenClawTab = currentTabs?.find(
					(tab) => tab.type === "openClawWebUi" && (!href || tab.href === href),
				);
				if (existingOpenClawTab) {
					await tabService.handleActivateTab(existingOpenClawTab.id);
					return false;
				}
				return true;
			})
			.with("htmlPreview", async () => {
				// Check if a tab with the same previewId already exists
				if (previewId) {
					const existingPreviewTab = currentTabs?.find(
						(tab) => tab.type === "htmlPreview" && tab.previewId === previewId,
					);
					if (existingPreviewTab) {
						// Just activate existing tab, don't update content
						await tabService.handleActivateTab(existingPreviewTab.id);
						return false;
					}
				}
				return true;
			})
			.exhaustive();

		if (shouldCreateNewTab) {
			// Backend will create tab and update storage
			await tabService.handleNewTab(title, type, active, href, content, previewId);
			// Wait for PersistedState sync to update frontend
		}
	}

	handleNewTabForExistingThread = throttle(
		(threadId: string, initialSearchQuery?: string, initialSearchResultIds?: string[]) => {
			this.#doHandleNewTabForExistingThread(
				threadId,
				initialSearchQuery,
				initialSearchResultIds,
			);
		},
		NEW_TAB_THROTTLE_MS,
		{ edges: ["leading"] },
	);

	async #doHandleNewTabForExistingThread(
		threadId: string,
		initialSearchQuery?: string,
		initialSearchResultIds?: string[],
	) {
		// This method can be called from both shell views and tab views
		// Use real window.windowId to ensure correct behavior regardless of context
		const currentWindowId = this.currentWindowId;

		console.log(
			`[TabBarState] handleNewTabForExistingThread: threadId=${threadId}, currentWindowId=${currentWindowId}`,
		);

		// IMPORTANT: Do NOT use persistedTabState.current here - it may be stale due to async IPC sync
		// Instead, get the current window's tabs directly from backend
		const currentWindowTabs = await this.getCurrentWindowTabs();
		console.log(`[TabBarState] Current window tabs from backend:`, currentWindowTabs);

		// Check if tab with this threadId already exists in current window
		if (currentWindowTabs && currentWindowTabs.length > 0) {
			const existingTab = currentWindowTabs.find((tab) => tab.threadId === threadId);
			if (existingTab) {
				// Found the tab in current window - activate it
				console.log(
					`[TabBarState] Found tab ${existingTab.id} in current window, activating it`,
				);
				await this.handleActivateTab(existingTab.id);
				return;
			}
		}

		// Thread doesn't exist in current window - create a new tab in current window
		console.log(
			`[TabBarState] Thread ${threadId} not found in current window, creating new tab`,
		);

		// Tab limit check (reuse currentWindowTabs from above, no extra IPC call)
		if (currentWindowTabs && currentWindowTabs.length >= MAX_TABS_PER_WINDOW) {
			const activeThreadId = currentWindowTabs.find((t) => t.active)?.threadId;
			broadcastService.broadcastToAll("show-toast", {
				type: "warning",
				message: m.toast_tab_limit_reached(),
				threadId: activeThreadId,
			});
			return;
		}

		const threadData = await threadService.getThread(threadId);
		if (!threadData) {
			console.log(`[TabBarState] Thread data not found for ${threadId}`);
			return;
		}

		console.log(`[TabBarState] Calling handleNewTabWithThread for thread ${threadId}`);
		// Backend will create tab and update storage
		const result = await tabService.handleNewTabWithThread(
			threadId,
			threadData.thread.title,
			"chat",
			true,
			initialSearchQuery,
			initialSearchResultIds,
		);
		console.log(`[TabBarState] handleNewTabWithThread result:`, result);
		// Wait for PersistedState sync to update frontend
	}

	updatePersistedTabs(tabs: Tab[]) {
		// Only shell views should update tab state
		if (!this.#isShellView) {
			console.warn("[TabBarState] updatePersistedTabs called in tab view, ignoring");
			return;
		}

		this.#safeUpdateWindowTabs(this.#windowId, tabs);
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

		await this.#handleTabRemovalWithActiveState(tabId, this.tabs);

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

		await this.#handleTabRemovalWithActiveState(tabId, this.tabs);
	}

	async updateTabTitle(threadId: string, title: string) {
		// This method can be called from both shell views and tab views
		// Use real window.windowId to ensure correct behavior
		const currentWindowId = this.currentWindowId;
		const currentTabs = await this.getCurrentWindowTabs();

		const updatedTabs = currentTabs?.map((tab) => {
			if (tab.threadId === threadId) {
				return { ...tab, title };
			}
			return tab;
		});

		// Use real windowId to ensure correct window is updated
		this.#safeUpdateWindowTabs(currentWindowId, updatedTabs ?? []);
	}
}

export const tabBarState = new TabBarState();
