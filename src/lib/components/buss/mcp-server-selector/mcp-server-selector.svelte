<script lang="ts">
	import EmptyMcpListIcon from "$lib/assets/icons/mcp/empty-mcp-list.svg";
	import McpServerForm from "$lib/components/buss/mcp-server-form/mcp-server-form.svelte";
	import SettingSearchInput from "$lib/components/buss/settings/setting-search-input.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import Checkbox from "$lib/components/ui/checkbox/checkbox.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as m from "$lib/paraglide/messages.js";
	import { mcpState } from "$lib/stores/mcp-state.svelte";

	import { Plus, Server } from "@lucide/svelte";
	import type { McpServerType } from "@shared/types";

	async function handleGoToMcpSettings() {
		await window.electronAPI.windowService.handleOpenSettingsWindow("/settings/mcp-settings");
	}

	interface Props {
		open: boolean;
		selectedServerIds: string[];
		onConfirm: (selectedIds: string[]) => void;
		filterType?: McpServerType;
	}

	let { open = $bindable(), selectedServerIds = [], onConfirm, filterType }: Props = $props();

	let searchTerm = $state("");
	let localSelectedIds = $state<string[]>([]);
	let currentView = $state<"list" | "add">("list");

	const filteredServers = $derived(
		mcpState.servers.filter(
			(server) =>
				(filterType ? server.type === filterType : true) &&
				(server.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
					server.description?.toLowerCase().includes(searchTerm.toLowerCase())),
		),
	);

	// 每次打开弹窗时，重新从 props 同步选中状态
	$effect(() => {
		if (open) {
			localSelectedIds = [...selectedServerIds];
			searchTerm = "";
			currentView = "list";
		}
	});

	function handleToggleServer(serverId: string) {
		let newSelectedIds: string[];
		if (localSelectedIds.includes(serverId)) {
			newSelectedIds = localSelectedIds.filter((id) => id !== serverId);
		} else {
			newSelectedIds = [...localSelectedIds, serverId];
		}
		localSelectedIds = newSelectedIds;
		onConfirm(newSelectedIds);
	}

	function handleBackToList() {
		currentView = "list";
	}

	function handleServerAdded(newServerId: string) {
		currentView = "list";
		if (!localSelectedIds.includes(newServerId)) {
			localSelectedIds = [...localSelectedIds, newServerId];
			onConfirm(localSelectedIds);
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="max-h-[700px] flex flex-col p-6 gap-4"
		showCloseButton={false}
		data-mcp-selector-dialog
	>
		{#if currentView === "list"}
			<div class="flex flex-col gap-4 flex-1 min-h-0">
				<div class="flex items-center gap-2">
					<div class="flex-1">
						<SettingSearchInput
							bind:value={searchTerm}
							placeholder={m.mcp_search_placeholder()}
						/>
					</div>
					<Button variant="outline" onclick={() => (currentView = "add")}>
						<Plus class="h-4 w-4" />
						{m.mcp_add()}
					</Button>
				</div>

				<div class="flex-1 overflow-y-auto min-h-0">
					{#if filteredServers.length === 0}
						{#if searchTerm}
							<div class="w-full text-muted-foreground py-8 text-center">
								{m.mcp_no_match()}
							</div>
						{:else}
							<div class="flex w-full flex-col items-center justify-center py-8">
								<img src={EmptyMcpListIcon} alt="" class="mb-4 h-24 w-24" />
								<p class="text-muted-foreground text-sm">
									{m.mcp_no_servers_empty_state()}<button
										type="button"
										class="text-primary hover:text-primary/80 cursor-pointer font-medium"
										onclick={handleGoToMcpSettings}
										>{m.mcp_click_to_settings()}</button
									>
								</p>
							</div>
						{/if}
					{:else}
						<div class="flex flex-col gap-2">
							{#each filteredServers as server (server.id)}
								<button
									type="button"
									class="block w-full cursor-pointer rounded-[10px] border-0 bg-white px-3.5 py-3 hover:bg-[#F9F9F9] dark:bg-background dark:hover:bg-[#2D2D2D]"
									onclick={() => handleToggleServer(server.id)}
								>
									<div class="flex w-full items-center justify-between gap-x-4">
										<div class="flex items-center gap-3 flex-1 min-w-0">
											<div
												class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted"
											>
												{#if server.icon}
													<span class="text-xl">{server.icon}</span>
												{:else}
													<Server class="text-muted-fg h-5 w-5" />
												{/if}
											</div>
											<div class="flex flex-col gap-1 flex-1 min-w-0">
												<h3
													class="text-setting-fg text-left text-sm font-medium truncate"
												>
													{server.name || server.id}
												</h3>
												{#if server.description}
													<p
														class="text-muted-fg text-left text-xs truncate"
													>
														{server.description}
													</p>
												{/if}
											</div>
										</div>
										<div class="flex items-center flex-shrink-0">
											<Checkbox
												checked={localSelectedIds.includes(server.id)}
											/>
										</div>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{:else if currentView === "add"}
			<div class="flex-1 overflow-y-auto min-h-0">
				<McpServerForm
					mode="add"
					onBack={handleBackToList}
					onSaveSuccess={handleServerAdded}
				/>
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
