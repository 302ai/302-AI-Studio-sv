<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import SettingSearchInput from "$lib/components/buss/settings/setting-search-input.svelte";
	import Checkbox from "$lib/components/ui/checkbox/checkbox.svelte";
	import { mcpState } from "$lib/stores/mcp-state.svelte";
	import { Server } from "@lucide/svelte";
	import * as m from "$lib/paraglide/messages.js";

	interface Props {
		open: boolean;
		selectedServerIds: string[];
		onClose: () => void;
		onConfirm: (selectedIds: string[]) => void;
	}

	let { open = $bindable(), selectedServerIds = [], onClose, onConfirm }: Props = $props();

	let searchTerm = $state("");
	let localSelectedIds = $state<string[]>([]);

	const filteredServers = $derived(
		mcpState.servers.filter(
			(server) =>
				server.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				server.description?.toLowerCase().includes(searchTerm.toLowerCase()),
		),
	);

	// 每次打开弹窗时，重新从 props 同步选中状态
	$effect(() => {
		if (open) {
			localSelectedIds = [...selectedServerIds];
			searchTerm = "";
		}
	});

	function handleToggleServer(serverId: string) {
		if (localSelectedIds.includes(serverId)) {
			localSelectedIds = localSelectedIds.filter((id) => id !== serverId);
		} else {
			localSelectedIds = [...localSelectedIds, serverId];
		}
	}

	function handleConfirm() {
		onConfirm(localSelectedIds);
		onClose();
	}

	function handleCancel() {
		onClose();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="w-[600px] max-h-[700px] flex flex-col p-6 gap-4">
		<Dialog.Header>
			<Dialog.Title>{m.mcp_select_servers()}</Dialog.Title>
		</Dialog.Header>

		<div class="flex flex-col gap-4 flex-1 min-h-0">
			<SettingSearchInput bind:value={searchTerm} placeholder={m.mcp_search_placeholder()} />

			<div class="flex-1 overflow-y-auto min-h-0">
				{#if filteredServers.length === 0}
					<div class="text-muted-foreground py-8 text-center">
						{searchTerm ? m.mcp_no_match() : m.mcp_no_servers()}
					</div>
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
											<h3 class="text-setting-fg text-left text-sm font-medium truncate">
												{server.name || server.id}
											</h3>
											{#if server.description}
												<p class="text-muted-fg text-left text-xs truncate">{server.description}</p>
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-2 flex-shrink-0">
										<span
											class="text-setting-fg text-xs {server.enabled
												? 'text-green-600'
												: 'text-gray-400'}"
										>
											{server.enabled ? m.mcp_enabled() : m.mcp_disabled()}
										</span>
										<Checkbox checked={localSelectedIds.includes(server.id)} />
									</div>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={handleCancel}>{m.mcp_cancel()}</Button>
			<Button onclick={handleConfirm}>{m.mcp_confirm()}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
