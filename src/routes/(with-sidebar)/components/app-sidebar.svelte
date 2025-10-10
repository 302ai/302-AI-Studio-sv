<script lang="ts">
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Input } from "$lib/components/ui/input";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { m } from "$lib/paraglide/messages";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { threadsState } from "$lib/stores/threads-state.svelte";
	import { ChevronDown } from "@lucide/svelte";
	import RenameDialog from "./rename-dialog.svelte";
	import ThreadItem from "./thread-item.svelte";

	type TimeGroup = "today" | "yesterday" | "last7days" | "last30days" | "earlier";

	let searchQuery = $state("");
	let groupCollapsedState = $state<Record<TimeGroup, boolean>>({
		today: true,
		yesterday: true,
		last7days: true,
		last30days: true,
		earlier: true,
	});
	let renameDialogOpen = $state(false);
	let renameTargetThreadId = $state<string | null>(null);
	let renameTargetName = $state("");

	function getTimeGroup(date: Date): TimeGroup {
		const now = new Date();
		const diffTime = now.getTime() - new Date(date).getTime();
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "today";
		if (diffDays === 1) return "yesterday";
		if (diffDays < 7) return "last7days";
		if (diffDays < 30) return "last30days";
		return "earlier";
	}

	function getGroupLabel(group: TimeGroup): string {
		switch (group) {
			case "today":
				return m.label_today();
			case "yesterday":
				return m.label_yesterday();
			case "last7days":
				return m.label_last_7_days();
			case "last30days":
				return m.label_last_30_days();
			case "earlier":
				return m.label_earlier();
		}
	}

	const filteredThreadList = $derived.by(async () => {
		if (!searchQuery.trim()) return threadsState.threads;

		const threads = await threadsState.threads;

		return threads.filter(({ thread }) =>
			thread.title.toLowerCase().includes(searchQuery.toLowerCase().trim()),
		);
	});

	const groupedThreadList = $derived.by(async () => {
		if (searchQuery.trim()) return null;

		const threads = await threadsState.threads;
		const groups: Record<TimeGroup, typeof threads> = {
			today: [],
			yesterday: [],
			last7days: [],
			last30days: [],
			earlier: [],
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
		const existingTab = tabBarState.tabs.find((tab) => tab.threadId === threadId);
		if (existingTab) {
			await tabBarState.handleActivateTab(existingTab.id);
		} else {
			await tabBarState.handleNewTabForExistingThread(threadId);
		}
	}

	async function handleThreadDelete(threadId: string) {
		const relatedTab = tabBarState.tabs.find((tab) => tab.threadId === threadId);
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
</script>

<Sidebar.Root collapsible="offcanvas" variant="sidebar" class="border-none">
	<Sidebar.Header class="px-4 pb-0">
		<Input
			class="bg-background! h-10"
			bind:value={searchQuery}
			placeholder={m.placeholder_input_search()}
		/>
	</Sidebar.Header>
	<Sidebar.Content>
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
								onThreadDelete={handleThreadDelete}
							/>
						{/each}
					{/await}
				{:else}
					{#await groupedThreadList then groupedThreads}
						{#if groupedThreads}
							{#each ["today", "yesterday", "last7days", "last30days", "earlier"] as groupKey (groupKey)}
								{@const gk = groupKey as TimeGroup}
								{@const group = groupedThreads[gk]}
								{#if group.length > 0}
									<Collapsible.Root
										bind:open={groupCollapsedState[gk]}
										class="group/collapsible flex flex-col gap-y-1"
									>
										<Collapsible.Trigger
											class="text-muted-foreground flex items-center justify-between text-start w-full h-10 rounded-[10px] px-3 hover:bg-secondary"
										>
											<span>{getGroupLabel(gk)}</span>
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
													onThreadDelete={handleThreadDelete}
												/>
											{/each}
										</Collapsible.Content>
									</Collapsible.Root>
								{/if}
							{/each}
						{/if}
					{/await}
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
