<script lang="ts">
	import { goto } from "$app/navigation";
	import Button from "$lib/components/ui/button/button.svelte";
	import SettingSearchInput from "$lib/components/buss/settings/setting-search-input.svelte";
	import { McpImportModal, type ImportData } from "$lib/components/buss/mcp-import-modal/index.js";
	import { mcpState } from "$lib/stores/mcp-state.svelte";
	import { Plus, Upload, Server } from "@lucide/svelte";
	import * as m from "$lib/paraglide/messages.js";
	import { nanoid } from "nanoid";

	let searchTerm = $state("");
	let isLoading = $state(false);
	let showImportModal = $state(false);

	const filteredServers = $derived(
		mcpState.servers.filter(
			(server) =>
				server.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				server.description?.toLowerCase().includes(searchTerm.toLowerCase()),
		),
	);

	function handleAddServer() {
		goto("/settings/mcp-settings/add");
	}

	function handleImportServers() {
		showImportModal = true;
	}

	function handleServerClick(serverId: string) {
		goto(`/settings/mcp-settings/edit/${serverId}`);
	}

	function handleImport(data: ImportData) {
		const now = new Date();
		mcpState.addServer({
			id: nanoid(),
			name: data.name,
			description: "",
			type: data.type,
			url: data.url || null,
			command: data.command || null,
			icon: "",
			enabled: true,
			order: mcpState.servers.length,
			createdAt: now,
			updatedAt: now,
			advancedSettings: {
				customEnvVars: data.env,
			},
		});
	}
</script>

<div class="flex w-full flex-col gap-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-medium text-[#333333] dark:text-[#E6E6E6]">{m.mcp_servers()}</h2>
		<div class="flex gap-2">
			<Button variant="outline" size="sm" onclick={handleImportServers}>
				<Upload class="size-4" />
				{m.mcp_import()}
			</Button>
			<Button size="sm" onclick={handleAddServer}>
				<Plus class="size-4" />
				{m.mcp_add()}
			</Button>
		</div>
	</div>

	<SettingSearchInput bind:value={searchTerm} placeholder={m.mcp_search_placeholder()} />

	<div class="flex w-full flex-col gap-2 pb-4">
		{#if isLoading}
			<div class="text-muted-foreground py-8 text-center">{m.mcp_loading()}</div>
		{:else if filteredServers.length === 0}
			<div class="text-muted-foreground py-8 text-center">
				{searchTerm ? m.mcp_no_match() : m.mcp_no_servers()}
			</div>
		{:else}
			{#each filteredServers as server (server.id)}
				<button
					type="button"
					class="block w-full cursor-pointer rounded-[10px] border-0 bg-white px-3.5 py-3 hover:bg-[#F9F9F9] dark:bg-background dark:hover:bg-[#2D2D2D]"
					onclick={() => handleServerClick(server.id)}
				>
					<div class="flex w-full items-center justify-between gap-x-10">
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
								{#if server.icon}
									<span class="text-xl">{server.icon}</span>
								{:else}
									<Server class="text-muted-fg h-5 w-5" />
								{/if}
							</div>
							<div class="flex flex-col gap-1">
								<h3 class="text-setting-fg text-left text-sm font-medium">
									{server.name || server.id}
								</h3>
								{#if server.description}
									<p class="text-muted-fg text-left text-xs">{server.description}</p>
								{/if}
							</div>
						</div>
						<div class="text-setting-fg text-sm">
							{server.enabled ? m.mcp_enabled() : m.mcp_disabled()}
						</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>
</div>

<McpImportModal
	bind:open={showImportModal}
	onClose={() => (showImportModal = false)}
	onImport={handleImport}
/>
