<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { Input } from "$lib/components/ui/input";
	import { m } from "$lib/paraglide/messages";
	import {
		claudeCodeSandboxState,
		persistedClaudeCodeSandboxState,
	} from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { formatDateTimeFull } from "$lib/utils/date-format";
	import { RotateCw, Search } from "@lucide/svelte";
	import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";
	import { onMount } from "svelte";
	import SandboxDeleteConfirmDialog from "./sandbox-delete-confirm-dialog.svelte";
	import SandboxDialog from "./sandbox-dialog.svelte";
	import SandboxRemarkDialog from "./sandbox-remark-dialog.svelte";

	let searchQuery = $state("");
	let isLoading = $state(false);
	let selectedSandbox = $state<ClaudeCodeSandboxInfo | null>(null);
	let isDialogOpen = $state(false);
	let isRenameDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let targetSandbox = $state<ClaudeCodeSandboxInfo | null>(null);

	// Filter sandboxes based on search query
	const filteredSandboxes = $derived.by(() => {
		const sandboxes = persistedClaudeCodeSandboxState.current;
		if (!searchQuery.trim()) return sandboxes;

		const query = searchQuery.toLowerCase();
		return sandboxes.filter(
			(sandbox) =>
				sandbox.sandboxId.toLowerCase().includes(query) ||
				sandbox.sandboxRemark.toLowerCase().includes(query),
		);
	});

	// Format time from ISO string
	function formatTime(isoString: string): string {
		return formatDateTimeFull(isoString);
	}

	// Refresh sandbox list
	async function handleRefresh() {
		isLoading = true;
		try {
			await claudeCodeSandboxState.refreshSandboxes();
		} finally {
			isLoading = false;
		}
	}

	function handleSandboxClick(sandbox: ClaudeCodeSandboxInfo) {
		selectedSandbox = sandbox;
		isDialogOpen = true;
	}

	async function handleSandboxDeleted() {
		isDialogOpen = false;
		// await handleRefresh();
	}

	function handleCloseSandbox() {
		isDialogOpen = false;
	}

	function handleModifyRemark(sandbox: ClaudeCodeSandboxInfo) {
		targetSandbox = sandbox;
		isRenameDialogOpen = true;
	}

	function handleDeleteClick(sandbox: ClaudeCodeSandboxInfo) {
		targetSandbox = sandbox;
		isDeleteDialogOpen = true;
	}

	async function handleConfirmRename(newName: string) {
		if (!targetSandbox) return;
		await claudeCodeSandboxState.updateSandboxRemark(targetSandbox.sandboxId, newName);
		isRenameDialogOpen = false;
		// await handleRefresh();
	}

	// Auto-refresh on mount
	onMount(() => {
		// handleRefresh();
	});
</script>

<!-- Agent Sandbox List Section -->
<div class="space-y-3">
	<div class="flex items-center justify-between">
		<h2 class="text-base font-medium">{m.title_agent_sandbox_list()}</h2>
		<Button
			variant="ghost"
			size="icon"
			class="h-8 w-8 text-muted-foreground hover:text-foreground"
			onclick={handleRefresh}
			disabled={isLoading}
		>
			<RotateCw class="h-4 w-4 {isLoading ? 'animate-spin' : ''}" />
		</Button>
	</div>

	<!-- Search -->
	<div class="relative">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			placeholder={m.placeholder_search_agent()}
			class="pl-9 bg-muted/50 border-transparent focus-visible:ring-0 focus-visible:bg-background"
			bind:value={searchQuery}
		/>
	</div>

	<!-- Sandbox List -->
	{#if filteredSandboxes.length === 0}
		<Empty.Root>
			<Empty.Content class="h-[200px] flex flex-col items-center justify-start pt-8">
				<Empty.Description>
					{searchQuery ? m.no_search_results() : m.no_sandboxes()}
				</Empty.Description>
			</Empty.Content>
		</Empty.Root>
	{:else}
		<div class="flex flex-col gap-2">
			{#each filteredSandboxes as sandbox (sandbox.sandboxId)}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<ContextMenu.Root>
					<ContextMenu.Trigger>
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="flex items-center justify-between rounded-lg bg-muted/50 p-4 hover:bg-muted/70 transition-colors cursor-pointer"
							onclick={() => handleSandboxClick(sandbox)}
						>
							<div class="flex flex-col gap-1">
								<span class="font-medium text-sm">
									{sandbox.sandboxRemark || sandbox.sandboxId}
								</span>
								<span class="text-xs text-muted-foreground">{sandbox.sandboxId}</span>
							</div>
							<div class="flex flex-col items-end gap-1">
								<span class="text-xs text-muted-foreground">
									{m.label_agent_sandbox_count({ count: String(sandbox.sessionInfos.length) })}
								</span>
								<span class="text-xs text-muted-foreground">{formatTime(sandbox.updatedAt)}</span>
							</div>
						</div>
					</ContextMenu.Trigger>
					<ContextMenu.Content>
						<ContextMenu.Item onclick={() => handleModifyRemark(sandbox)}>
							{m.text_button_edit ? m.text_button_edit() : "Edit"}
						</ContextMenu.Item>
						<ContextMenu.Item
							class="text-destructive focus:text-destructive"
							onclick={() => handleDeleteClick(sandbox)}
						>
							{m.text_button_delete ? m.text_button_delete() : "Delete"}
						</ContextMenu.Item>
					</ContextMenu.Content>
				</ContextMenu.Root>
			{/each}
		</div>
	{/if}

	<SandboxDialog
		bind:open={isDialogOpen}
		sandbox={selectedSandbox}
		onDelete={handleSandboxDeleted}
		onClose={handleCloseSandbox}
	/>

	<SandboxRemarkDialog
		bind:open={isRenameDialogOpen}
		sandboxId={targetSandbox?.sandboxId || ""}
		remark={targetSandbox?.sandboxRemark || ""}
		onClose={() => (isRenameDialogOpen = false)}
		onSave={handleConfirmRename}
	/>

	<SandboxDeleteConfirmDialog bind:open={isDeleteDialogOpen} sandbox={targetSandbox} />
</div>
