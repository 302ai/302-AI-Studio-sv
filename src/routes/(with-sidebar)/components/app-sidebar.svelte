<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Input } from "$lib/components/ui/input";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { m } from "$lib/paraglide/messages";
	import { sidebarSearchState } from "$lib/stores/sidebar-search-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { threadsState } from "$lib/stores/threads-state.svelte";
	import { TIME_GROUP_ORDER, TimeGroup } from "$lib/types/time-group";
	import type { MessagePart } from "$lib/utils/attachment-converter";
	import { ChevronDown } from "@lucide/svelte";
	import { onMount } from "svelte";
	import RenameDialog from "./rename-dialog.svelte";
	import ThreadItem from "./thread-item.svelte";

	let searchQuery = $state("");
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

	onMount(() => {
		// Register focus callback
		const cleanup = sidebarSearchState.registerFocusCallback(() => {
			searchInputElement?.focus();
		});

		return cleanup;
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
		if (!searchQuery.trim()) return threadsState.threads;

		const threads = threadsState.threads;
		const searchTerm = searchQuery.toLowerCase().trim();

		const { storageService } = window.electronAPI;

		// Filter threads by title or message content
		const filtered = await Promise.all(
			threads.map(async (threadData) => {
				// Check title first
				if (threadData.thread.title.toLowerCase().includes(searchTerm)) {
					return { match: true, threadData };
				}

				// Check message content
				try {
					const messagesData = await storageService.getItem(
						`app-chat-messages:${threadData.threadId}`,
					);
					const messages = messagesData;
					if (Array.isArray(messages)) {
						const hasMatchingMessage = messages.some((msg) => {
							if (Array.isArray(msg.parts)) {
								return msg.parts.some((part: MessagePart) => {
									if (part.type === "text" && typeof part.text === "string") {
										return part.text.toLowerCase().includes(searchTerm);
									}
									return false;
								});
							}
							return false;
						});
						if (hasMatchingMessage) {
							return { match: true, threadData };
						}
					}
				} catch (error) {
					console.warn(`Failed to load messages for thread ${threadData.threadId}:`, error);
				}

				return { match: false, threadData };
			}),
		);

		return filtered.filter((item) => item.match).map((item) => item.threadData);
	});

	const groupedThreadList = $derived.by(() => {
		if (searchQuery.trim()) return null;

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
				(a, b) => new Date(b.thread.updatedAt).getTime() - new Date(a.thread.updatedAt).getTime(),
			);
		});

		return groups;
	});

	async function handleThreadClick(threadId: string) {
		// Use getCurrentWindowTabs() to get real tabs in current window
		const currentTabs = tabBarState.getCurrentWindowTabs();
		const existingTab = currentTabs.find((tab) => tab.threadId === threadId);
		if (existingTab) {
			// Tab exists in current window, activate it
			await tabBarState.handleActivateTab(existingTab.id);
		} else {
			// Tab doesn't exist, create or focus in other window
			await tabBarState.handleNewTabForExistingThread(threadId);
		}
	}

	async function handleThreadDelete(threadId: string) {
		// Use getCurrentWindowTabs() to get real tabs in current window
		const currentTabs = tabBarState.getCurrentWindowTabs();
		const relatedTab = currentTabs.find((tab) => tab.threadId === threadId);
		if (relatedTab) {
			await tabBarState.handleTabClose(relatedTab.id);
		}

		const success = await threadsState.deleteThread(threadId);
		if (!success) {
			console.error("Failed to delete thread:", threadId);
		}
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

		await threadsState.renameThread(renameTargetThreadId, trimmedName);
		tabBarState.updateTabTitle(renameTargetThreadId, trimmedName);
		closeRenameDialog();
	}

	async function handleThreadGenerateTitle(threadId: string) {
		// Use getCurrentWindowTabs() to get real tabs in current window
		const currentTabs = tabBarState.getCurrentWindowTabs();
		const relatedTab = currentTabs.find((tab) => tab.threadId === threadId);

		if (relatedTab?.type === "chat" && relatedTab.threadId) {
			const { tabService } = window.electronAPI;
			await tabService.handleGenerateTabTitle(relatedTab.id, relatedTab.threadId);
		}
	}

	async function handleThreadClearMessages(threadId: string) {
		// Use getCurrentWindowTabs() to get real tabs in current window
		const currentTabs = tabBarState.getCurrentWindowTabs();
		const relatedTab = currentTabs.find((tab) => tab.threadId === threadId);

		if (relatedTab?.type === "chat" && relatedTab.threadId) {
			const { tabService } = window.electronAPI;
			await tabService.handleClearTabMessages(relatedTab.id, relatedTab.threadId);
		}
	}
</script>

<Sidebar.Root collapsible="offcanvas" variant="sidebar" class="border-none">
	<Sidebar.Header class="px-4 pb-2">
		<Input
			class="bg-background! h-10 rounded-[10px]"
			bind:value={searchQuery}
			bind:ref={searchInputElement}
			placeholder={m.placeholder_input_search()}
		/>
	</Sidebar.Header>
	<Sidebar.Content class="bg-input pt-0">
		<Sidebar.Group>
			<Sidebar.GroupContent class="flex flex-col gap-y-1 px-3">
				{#if searchQuery.trim()}
					{#await filteredThreadList then threads}
						{#each threads as { threadId, thread, isFavorite } (threadId)}
							<ThreadItem
								{threadId}
								{thread}
								{isFavorite}
								isActive={threadId === threadsState.activeThreadId}
								onThreadClick={handleThreadClick}
								onToggleFavorite={() => threadsState.toggleFavorite(threadId)}
								onRenameThread={handleRenameThread}
								onThreadGenerateTitle={handleThreadGenerateTitle}
								onThreadClearMessages={handleThreadClearMessages}
								onThreadDelete={handleThreadDelete}
							/>
						{/each}
					{/await}
				{:else if groupedThreadList}
					{#each TIME_GROUP_ORDER as groupKey (groupKey)}
						{@const group = groupedThreadList[groupKey]}
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
									{#each group as { threadId, thread, isFavorite } (threadId)}
										<ThreadItem
											{threadId}
											{thread}
											{isFavorite}
											isActive={threadId === threadsState.activeThreadId}
											onThreadClick={handleThreadClick}
											onToggleFavorite={() => threadsState.toggleFavorite(threadId)}
											onRenameThread={handleRenameThread}
											onThreadGenerateTitle={handleThreadGenerateTitle}
											onThreadClearMessages={handleThreadClearMessages}
											onThreadDelete={handleThreadDelete}
										/>
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
