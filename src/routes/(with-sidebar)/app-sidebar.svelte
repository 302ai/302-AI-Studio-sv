<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import { m } from "$lib/paraglide/messages";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { threadsState } from "$lib/stores/threads-state.svelte";
	import { Heart, MessageSquare } from "@lucide/svelte";
	import type { Tab, ThreadParmas } from "@shared/types";
	import { parse } from "superjson";

	const { storageService, tabService } = window.electronAPI;

	let searchQuery = $state("");

	function formatDate(date: Date): string {
		const now = new Date();
		const diffTime = now.getTime() - new Date(date).getTime();
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

		if (diffDays === 0) {
			return "Today";
		} else if (diffDays === 1) {
			return "Yesterday";
		} else if (diffDays < 7) {
			return `${diffDays} days ago`;
		} else {
			return new Date(date).toLocaleDateString();
		}
	}

	async function handleThreadClick(threadId: string) {
		const existingTab = tabBarState.tabs.find((tab) => tab.threadId === threadId);

		if (existingTab) {
			await tabBarState.handleActivateTab(existingTab.id);
		} else {
			try {
				const thread = (await storageService.getItem("app-thread:" + threadId)) as ThreadParmas;
				const title = thread?.title || "Chat";

				const newTabData = await tabService.handleNewTabWithThread(threadId, title, "chat", true);

				if (newTabData) {
					const newTab = parse<Tab>(newTabData);

					const currentTabs = tabBarState.tabs;
					const updatedTabs = currentTabs.map((tab) => ({ ...tab, active: false }));
					updatedTabs.push(newTab);
					tabBarState.updatePersistedTabs(updatedTabs);

					console.log("Created new tab for existing thread:", threadId);
				}
			} catch (error) {
				console.error("Failed to create tab for thread:", error);
			}
		}
	}

	async function handleToggleFavorite(threadId: string, event: Event) {
		event.stopPropagation();
		await threadsState.toggleFavorite(threadId);
	}
</script>

<Sidebar.Root collapsible="offcanvas" variant="sidebar">
	<Sidebar.Header>
		<Input
			class="bg-background! h-10"
			bind:value={searchQuery}
			placeholder={m.placeholder_input_search()}
		/>
	</Sidebar.Header>
	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupLabel>Recent Threads</Sidebar.GroupLabel>
			<Sidebar.GroupContent>
				{#await threadsState.threads}
					<div class="px-4 py-2 text-sm text-muted-foreground">Loading...</div>
				{:then threads}
					{#if threads.length === 0}
						<div class="px-4 py-2 text-sm text-muted-foreground">No threads found</div>
					{:else}
						<Sidebar.Menu>
							{#each threads as { threadId, thread, isFavorite } (threadId)}
								<Sidebar.MenuItem>
									<Sidebar.MenuButton>
										{#snippet child({ props })}
											<div
												{...props}
												class="w-full text-left group relative flex items-center gap-2 p-2 hover:bg-accent rounded cursor-pointer"
												role="button"
												tabindex="0"
												onclick={() => handleThreadClick(threadId)}
												onkeydown={(e) => {
													if (e.key === "Enter" || e.key === " ") {
														e.preventDefault();
														handleThreadClick(threadId);
													}
												}}
											>
												<MessageSquare class="h-4 w-4 flex-shrink-0" />
												<div class="flex flex-col items-start min-w-0 flex-1">
													<span class="text-sm truncate w-full">{thread.title || "Untitled"}</span>
													<span class="text-xs text-muted-foreground">
														{formatDate(thread.updatedAt)}
													</span>
												</div>
												<div
													role="button"
													tabindex="0"
													onclick={(e) => handleToggleFavorite(threadId, e)}
													onkeydown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															handleToggleFavorite(threadId, e);
														}
													}}
													class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-accent rounded cursor-pointer"
													aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
												>
													<Heart
														class="h-3 w-3 {isFavorite
															? 'fill-red-500 text-red-500'
															: 'text-muted-foreground'}"
													/>
												</div>
											</div>
										{/snippet}
									</Sidebar.MenuButton>
								</Sidebar.MenuItem>
							{/each}
						</Sidebar.Menu>
					{/if}
				{:catch _error}
					<div class="px-4 py-2 text-sm text-destructive">Failed to load threads</div>
				{/await}
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>
</Sidebar.Root>
