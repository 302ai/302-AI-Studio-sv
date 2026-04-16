<script lang="ts">
	import { updateSessionNote } from "$lib/api/sandbox-session";
	import { isLocalOrCloudMode } from "$lib/api/utils";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Input } from "$lib/components/ui/input";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { Skeleton } from "$lib/components/ui/skeleton/index.js";
	import { m } from "$lib/paraglide/messages";
	import { persistedClaudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { sidebarSearchState } from "$lib/stores/sidebar-search-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { threadsState } from "$lib/stores/threads-state.svelte";
	import { TIME_GROUP_ORDER, TimeGroup } from "$lib/types/time-group";
	import { ChevronDown } from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import type { CodeAgentConfigMetadata, CodeAgentMetadata } from "@shared/storage/code-agent";
	import { isChatTab } from "@shared/storage/tab";
	import { onMount } from "svelte";
	import { SvelteMap } from "svelte/reactivity";
	import RenameDialog from "./rename-dialog.svelte";
	import ThreadDeleteDialog from "./thread-delete-dialog.svelte";
	import ThreadItem from "./thread-item.svelte";

	const logger = createLogger("ui");

	let searchInputElement: HTMLInputElement | null = $state(null);
	let groupCollapsedState = $state<Record<TimeGroup, boolean>>({
		[TimeGroup.TODAY]: true,
		[TimeGroup.YESTERDAY]: true,
		[TimeGroup.LAST_7_DAYS]: true,
		[TimeGroup.LAST_30_DAYS]: true,
		[TimeGroup.EARLIER]: true,
	});
	let renameDialogOpen = $state(false);
	let renameTargetThreadId = $state<string | null>(null);
	let renameTargetName = $state("");
	let deleteDialogOpen = $state(false);
	let deleteTargetThreadId = $state<string | null>(null);
	let deleteSandboxId = $state<string | null>(null);
	let deleteSessionId = $state<string | null>(null);
	const searchSkeletonItems = Array.from({ length: 6 }, (_, index) => index);

	onMount(() => {
		// Initialize search state for this tab
		sidebarSearchState.initializeForTab();

		// Register focus callback
		const cleanupFocus = sidebarSearchState.registerFocusCallback(() => {
			searchInputElement?.focus();
		});

		// 监听其他标签页的搜索词变化
		let cleanupSearchSync: (() => void) | undefined;
		if (typeof window !== "undefined" && window.electronAPI?.onSidebarSearchChanged) {
			cleanupSearchSync = window.electronAPI.onSidebarSearchChanged((data) => {
				sidebarSearchState.applyBroadcastUpdate(data.query);
			});
		}

		// 监听其他标签页的搜索结果更新
		let cleanupSearchResultsSync: (() => void) | undefined;
		if (typeof window !== "undefined" && window.electronAPI?.onSidebarSearchResultsUpdated) {
			cleanupSearchResultsSync = window.electronAPI.onSidebarSearchResultsUpdated((data) => {
				sidebarSearchState.applySearchResultsBroadcast(data.query, data.resultIds);
			});
		}

		return () => {
			cleanupFocus();
			cleanupSearchSync?.();
			cleanupSearchResultsSync?.();
		};
	});

	const DAY_IN_MS = 1000 * 60 * 60 * 24;

	function getStartOfDay(date: Date): Date {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const start = new Date(date);
		start.setHours(0, 0, 0, 0);
		return start;
	}

	function getTimeGroup(date: Date | string): TimeGroup {
		const targetDate = new Date(date);
		if (Number.isNaN(targetDate.getTime())) {
			return TimeGroup.EARLIER;
		}

		const todayStart = getStartOfDay(new Date());
		const targetStart = getStartOfDay(targetDate);
		const diffTime = todayStart.getTime() - targetStart.getTime();
		const diffDays = Math.floor(diffTime / DAY_IN_MS);

		if (diffDays <= 0) return TimeGroup.TODAY;
		if (diffDays === 1) return TimeGroup.YESTERDAY;
		if (diffDays <= 6) return TimeGroup.LAST_7_DAYS;
		if (diffDays <= 29) return TimeGroup.LAST_30_DAYS;
		return TimeGroup.EARLIER;
	}

	function getGroupLabel(group: TimeGroup): string {
		switch (group) {
			case TimeGroup.TODAY:
				return m.label_today();
			case TimeGroup.YESTERDAY:
				return m.label_yesterday();
			case TimeGroup.LAST_7_DAYS:
				return m.label_last_7_days();
			case TimeGroup.LAST_30_DAYS:
				return m.label_last_30_days();
			case TimeGroup.EARLIER:
				return m.label_earlier();
		}
	}

	const filteredThreadList = $derived.by(async () => {
		if (!sidebarSearchState.searchQuery.trim()) return threadsState.threads;
		return sidebarSearchState.searchThreads(threadsState.threads);
	});

	const groupedThreadList = $derived.by(() => {
		if (sidebarSearchState.searchQuery.trim()) return null;

		const threads = threadsState.threads;
		const groups: Record<TimeGroup, typeof threads> = {
			[TimeGroup.TODAY]: [],
			[TimeGroup.YESTERDAY]: [],
			[TimeGroup.LAST_7_DAYS]: [],
			[TimeGroup.LAST_30_DAYS]: [],
			[TimeGroup.EARLIER]: [],
		};

		threads.forEach((threadData) => {
			const group = getTimeGroup(threadData.thread.updatedAt);
			groups[group].push(threadData);
		});

		(Object.keys(groups) as TimeGroup[]).forEach((groupKey) => {
			groups[groupKey].sort(
				(a, b) =>
					new Date(b.thread.updatedAt).getTime() - new Date(a.thread.updatedAt).getTime(),
			);
		});

		return groups;
	});

	// Helper function to check if a thread has code agent enabled
	const codeAgentInfoPromiseCache = new SvelteMap<
		string,
		Promise<{
			isCodeAgent: boolean;
			sandboxId?: string;
			sessionId?: string;
		}>
	>();

	async function isCodeAgentThread(threadId: string): Promise<{
		isCodeAgent: boolean;
		sandboxId?: string;
		sessionId?: string;
	}> {
		try {
			const configKey = `CodeAgentStorage:code-agent-config-state-${threadId}`;
			const config = await window.electronAPI.storageService.getItem(configKey);

			if (
				(config as CodeAgentConfigMetadata)?.enabled &&
				((config as CodeAgentConfigMetadata)?.currentAgentId === "claude-code" ||
					(config as CodeAgentConfigMetadata)?.currentAgentId === "open-claw")
			) {
				// Get the Claude Code state for this thread
				const claudeStateKey = `CodeAgentStorage:claude-code-agent-state-${threadId}`;
				const claudeState = await window.electronAPI.storageService.getItem(claudeStateKey);

				const sandboxId = (claudeState as CodeAgentMetadata)?.sandboxId;
				const currentSessionId = (claudeState as CodeAgentMetadata)?.currentSessionId;

				if (sandboxId && currentSessionId) {
					// Handle local mode
					if (isLocalOrCloudMode()) {
						return {
							isCodeAgent: true,
							sandboxId: sandboxId,
							sessionId: currentSessionId,
						};
					}

					// Wait for sandbox state to be hydrated before accessing
					if (!persistedClaudeCodeSandboxState.isHydrated) {
						await persistedClaudeCodeSandboxState.refresh();
					}

					// Find the real session id from sessionInfos
					const sandbox = persistedClaudeCodeSandboxState.current.find(
						(s) => s.sandboxId === sandboxId,
					);
					if (sandbox) {
						const session = sandbox.sessionInfos.find(
							(s) => s.sessionId === currentSessionId,
						);
						if (session) {
							return {
								isCodeAgent: true,
								sandboxId: sandboxId,
								sessionId: session.sessionId,
							};
						}
						// Session not found in sessionInfos
						// logger.error(
						// 	`Session ${currentSessionId} not found in sandbox ${sandboxId} sessionInfos`,
						// );
						return { isCodeAgent: false };
					}
					// Sandbox not found in local state
					// logger.error(`Sandbox ${sandboxId} not found in local state`);
					return { isCodeAgent: false };
				}
			}
		} catch (error) {
			logger.error("Error checking code agent status:", error);
		}

		return { isCodeAgent: false };
	}

	function getCodeAgentInfo(threadId: string) {
		const cached = codeAgentInfoPromiseCache.get(threadId);
		if (cached) return cached;
		const promise = isCodeAgentThread(threadId);
		// Cache the promise without triggering reactive updates in template context
		Promise.resolve().then(() => {
			codeAgentInfoPromiseCache.set(threadId, promise);
		});
		return promise;
	}

	async function handleThreadClick(threadId: string) {
		// Get current search data to pass to new tab if clicking from search results
		const searchData = sidebarSearchState.getSearchDataForNewTab();

		const currentTabs = await tabBarState.getAllTabs();
		const existingTab = currentTabs?.find((tab) => tab.threadId === threadId);
		if (existingTab) {
			await tabBarState.handleActivateTab(existingTab.id);
			if (searchData?.query) {
				await window.electronAPI.broadcastService.broadcastToAll(
					"sidebar-search-navigate",
					{
						threadId,
						query: searchData.query,
					},
				);
			}
		} else {
			// Pass search query and result IDs when creating new tab from search results
			await tabBarState.handleNewTabForExistingThread(
				threadId,
				searchData?.query,
				searchData?.resultIds,
			);
		}
	}

	async function handleThreadDelete(threadId: string) {
		// Check if it's a code agent thread
		const { isCodeAgent, sandboxId, sessionId } = await isCodeAgentThread(threadId);

		if (isCodeAgent && sandboxId && sessionId) {
			// Show the dialog for code agent threads
			deleteTargetThreadId = threadId;
			deleteSandboxId = sandboxId;
			deleteSessionId = sessionId;
			deleteDialogOpen = true;
		} else {
			// Direct deletion for normal threads
			await performThreadDeletion(threadId);
		}
	}

	async function performThreadDeletion(threadId: string) {
		// Delete thread first (before closing tab, which broadcasts "thread-list-updated")
		const success = await threadsState.deleteThread(threadId);
		if (!success) {
			logger.error("Failed to delete thread:", threadId);
			return;
		}

		// Now close the tab — its broadcast will reload threads, but the deleted one is already gone
		const allTabs = await tabBarState.getAllTabs();
		const existingTab = allTabs?.find((tab) => tab.threadId === threadId);
		if (existingTab) {
			await tabBarState.handleTabClose(existingTab.id);
		}
	}

	function handleThreadDeleteWithDialog(threadId: string, sandboxId: string, sessionId: string) {
		deleteTargetThreadId = threadId;
		deleteSandboxId = sandboxId;
		deleteSessionId = sessionId;
		deleteDialogOpen = true;
	}

	async function handleDeleteDialogConfirm(_deleteRemoteSession: boolean) {
		if (!deleteTargetThreadId) return;

		// Perform the thread deletion
		await performThreadDeletion(deleteTargetThreadId);

		// Close dialog and reset state
		deleteDialogOpen = false;
		deleteTargetThreadId = null;
		deleteSandboxId = null;
		deleteSessionId = null;
	}

	function openRenameDialog() {
		renameDialogOpen = true;
	}

	function closeRenameDialog() {
		renameDialogOpen = false;
		renameTargetThreadId = null;
		renameTargetName = "";
	}

	function handleRenameThread(threadId: string, currentName: string) {
		renameTargetThreadId = threadId;
		renameTargetName = currentName;
		openRenameDialog();
	}

	async function handleRenameConfirm(newName: string) {
		if (!renameTargetThreadId) return;

		const trimmedName = newName.trim();
		if (!trimmedName) return;

		// Get agent info for updating session note
		const agentInfo = await isCodeAgentThread(renameTargetThreadId);

		await threadsState.renameThread(renameTargetThreadId, trimmedName);
		await tabBarState.updateTabTitle(renameTargetThreadId, trimmedName);

		// Update session note for code agent threads (preserves original sessionId)
		// But skip if user has manually set the session note
		if (agentInfo.isCodeAgent && agentInfo.sandboxId && agentInfo.sessionId) {
			// Check if the session note was manually set by user
			const claudeStateKey = `CodeAgentStorage:claude-code-agent-state-${renameTargetThreadId}`;
			const claudeState = (await window.electronAPI.storageService.getItem(
				claudeStateKey,
			)) as CodeAgentMetadata | undefined;
			const isManualNote = claudeState?.isManualNote ?? false;

			if (!isManualNote) {
				updateSessionNote({
					note: trimmedName,
					sandbox_id: agentInfo.sandboxId,
					session_id: agentInfo.sessionId,
				});
			}
		}

		closeRenameDialog();
	}

	async function handleThreadGenerateTitle(threadId: string) {
		// Use getCurrentWindowTabs() to get real tabs in current window
		const currentTabs = await tabBarState.getCurrentWindowTabs();
		const relatedTab = currentTabs?.find((tab) => tab.threadId === threadId);

		if (relatedTab && isChatTab(relatedTab.type) && relatedTab.threadId) {
			const { tabService } = window.electronAPI;
			await tabService.handleGenerateTabTitle(relatedTab.id, relatedTab.threadId);
		}
	}

	async function handleThreadClearMessages(threadId: string) {
		// Use getCurrentWindowTabs() to get real tabs in current window
		const currentTabs = await tabBarState.getCurrentWindowTabs();
		const relatedTab = currentTabs?.find((tab) => tab.threadId === threadId);

		if (relatedTab && isChatTab(relatedTab.type) && relatedTab.threadId) {
			const { tabService } = window.electronAPI;
			await tabService.handleClearTabMessages(relatedTab.id, relatedTab.threadId);
		}
	}
</script>

<Sidebar.Root collapsible="offcanvas" variant="sidebar" class="border-none">
	<Sidebar.Header class="px-4 pb-2">
		<Input
			class="bg-background! h-10 rounded-[10px]"
			value={sidebarSearchState.searchQuery}
			oninput={(e) => (sidebarSearchState.searchQuery = e.currentTarget.value)}
			bind:ref={searchInputElement}
			placeholder={m.placeholder_input_search()}
		/>
	</Sidebar.Header>
	<Sidebar.Content class="bg-input pt-0">
		<Sidebar.Group>
			<Sidebar.GroupContent class="flex flex-col gap-y-1 px-3">
				{#if sidebarSearchState.searchQuery.trim()}
					{#await filteredThreadList}
						<div class="flex flex-col gap-y-1 px-3">
							{#each searchSkeletonItems as item (item)}
								<Sidebar.MenuSkeleton class="h-10 rounded-[10px] px-3">
									<Skeleton class="size-4 rounded-sm ml-auto opacity-60" />
								</Sidebar.MenuSkeleton>
							{/each}
						</div>
					{:then threads}
						{#if threads.length === 0}
							<div class="px-3 py-2 text-sm text-muted-foreground">
								{m.no_search_results()}
							</div>
						{:else}
							{#each threads as threadData (threadData.threadId)}
								{@const { threadId, thread, isFavorite } = threadData}
								{#await getCodeAgentInfo(threadId) then agentInfo}
									<ThreadItem
										{threadId}
										{thread}
										{isFavorite}
										isActive={threadId === threadsState.activeThreadId}
										isCodeAgent={agentInfo.isCodeAgent}
										sandboxId={agentInfo.sandboxId || ""}
										sessionId={agentInfo.sessionId || ""}
										onThreadClick={handleThreadClick}
										onToggleFavorite={() =>
											threadsState.toggleFavorite(threadId)}
										onRenameThread={handleRenameThread}
										onThreadGenerateTitle={handleThreadGenerateTitle}
										onThreadClearMessages={handleThreadClearMessages}
										onThreadDelete={handleThreadDelete}
										onThreadDeleteWithDialog={handleThreadDeleteWithDialog}
									/>
								{/await}
							{/each}
						{/if}
					{/await}
				{:else if groupedThreadList}
					{#each TIME_GROUP_ORDER as groupKey (groupKey)}
						{@const group = groupedThreadList?.[groupKey] ?? []}
						{#if group.length > 0}
							<Collapsible.Root
								bind:open={groupCollapsedState[groupKey]}
								class="group/collapsible flex flex-col gap-y-1"
							>
								<Collapsible.Trigger
									class="flex items-center justify-between text-start w-full h-10 rounded-[10px] px-3 hover:bg-secondary/80 text-muted-foreground"
								>
									<span>{getGroupLabel(groupKey)}</span>
									<ChevronDown
										class="size-4 transition-transform duration-200 ease-in-out group-data-[state=open]/collapsible:rotate-180 group-data-[state=closed]/collapsible:rotate-0"
									/>
								</Collapsible.Trigger>
								<Collapsible.Content class="flex flex-col gap-y-1">
									{#each group as threadData (threadData.threadId)}
										{@const { threadId, thread, isFavorite } = threadData}
										{#await getCodeAgentInfo(threadId) then agentInfo}
											<ThreadItem
												{threadId}
												{thread}
												{isFavorite}
												isActive={threadId === threadsState.activeThreadId}
												isCodeAgent={agentInfo.isCodeAgent}
												sandboxId={agentInfo.sandboxId || ""}
												sessionId={agentInfo.sessionId || ""}
												onThreadClick={handleThreadClick}
												onToggleFavorite={() =>
													threadsState.toggleFavorite(threadId)}
												onRenameThread={handleRenameThread}
												onThreadGenerateTitle={handleThreadGenerateTitle}
												onThreadClearMessages={handleThreadClearMessages}
												onThreadDelete={handleThreadDelete}
												onThreadDeleteWithDialog={handleThreadDeleteWithDialog}
											/>
										{/await}
									{/each}
								</Collapsible.Content>
							</Collapsible.Root>
						{/if}
					{/each}
				{/if}
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>

<RenameDialog
	bind:open={renameDialogOpen}
	initialValue={renameTargetName}
	onClose={closeRenameDialog}
	onConfirm={(value) => {
		renameTargetName = value;
		handleRenameConfirm(value);
	}}
/>

<ThreadDeleteDialog
	bind:open={deleteDialogOpen}
	threadId={deleteTargetThreadId || ""}
	sandboxId={deleteSandboxId || ""}
	sessionId={deleteSessionId || ""}
	onClose={() => {
		deleteDialogOpen = false;
		deleteTargetThreadId = null;
		deleteSandboxId = null;
		deleteSessionId = null;
	}}
	onConfirm={handleDeleteDialogConfirm}
/>
