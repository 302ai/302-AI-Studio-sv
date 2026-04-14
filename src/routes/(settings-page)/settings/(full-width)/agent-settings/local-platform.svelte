<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import PodmanCard from "$lib/components/buss/local-agent-panel/podman-card.svelte";
	import SandboxCard from "$lib/components/buss/local-agent-panel/sandbox-card.svelte";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent";
	import { persistedLocalClaudeCodeSessionsState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { cn } from "$lib/utils";
	import { RotateCw, Search } from "@lucide/svelte";
	import type { LocalSessionInfo } from "@shared/storage/code-agent";
	import { onMount } from "svelte";
	import SandboxDeleteConfirmDialog from "./sandbox-delete-confirm-dialog.svelte";

	let searchQuery = $state("");
	let isLoading = $state(false);
	let targetSession = $state<LocalSessionInfo | null>(null);
	let isDeleteDialogOpen = $state(false);

	// Filter sessions based on search query
	const filteredSessions = $derived.by(() => {
		const sessions = persistedLocalClaudeCodeSessionsState.current;
		if (!searchQuery.trim()) return sessions;

		const query = searchQuery.toLowerCase();
		return sessions.filter(
			(session) =>
				session.session_id.toLowerCase().includes(query) ||
				(session.note?.toLowerCase().includes(query) ?? false) ||
				(session.workspace_path?.toLowerCase().includes(query) ?? false),
		);
	});

	async function handleRefresh() {
		isLoading = true;
		try {
			await codeAgentState.refreshSessions(undefined, "local");
		} finally {
			isLoading = false;
		}
	}

	function handleDeleteClick(session: LocalSessionInfo) {
		targetSession = session;
		isDeleteDialogOpen = true;
	}

	async function handleInstall() {
		await localEnvState.installPodman();
	}

	// Start listening for Podman events including WSL restart notifications
	onMount(() => {
		localEnvState.startPodmanListening();
	});
</script>

<div class="gap-settings-gap flex flex-col">
	<!-- Section 1: Environment Monitoring -->
	<section class="space-y-4">
		<Label class="text-label-fg font-normal">{m.local_platform_environment_monitoring()}</Label>

		<!-- Environment Cards Container -->
		<div class="rounded-lg border p-4 space-y-4">
			<PodmanCard isOpen={false} onInstall={handleInstall} />
			<SandboxCard />
		</div>
	</section>

	<!-- Section 2: Local Session List -->
	<section class="space-y-4 mt-6">
		<div class="flex items-center justify-between">
			<div class="flex items-center">
				<Label class="text-label-fg font-normal">{m.title_local_session_list()}</Label>
				<div class="flex gap-1">
					<ButtonWithTooltip
						class="hover:!bg-chat-action-hover"
						tooltip={m.label_button_reload()}
						onclick={handleRefresh}
						disabled={isLoading}
					>
						<RotateCw class={cn("h-4 w-4", isLoading ? "animate-spin" : "")} />
					</ButtonWithTooltip>
				</div>
			</div>
			<!-- Search -->
			<div class="relative">
				<Search
					class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					placeholder={m.placeholder_search_session()}
					class="pl-9 bg-muted/50 border-transparent focus-visible:ring-0 focus-visible:bg-background"
					bind:value={searchQuery}
				/>
			</div>
		</div>

		<!-- Session List -->
		<div class={cn("p-2", filteredSessions.length > 0 && "rounded-lg border bg-muted/20")}>
			{#if filteredSessions.length === 0}
				<Empty.Root>
					<Empty.Content class="h-[200px] flex flex-col items-center justify-start pt-8">
						<Empty.Description>
							{searchQuery ? m.no_search_results() : m.no_sessions()}
						</Empty.Description>
					</Empty.Content>
				</Empty.Root>
			{:else}
				<div class="max-h-[360px] overflow-y-auto pr-1">
					<div class="flex flex-col gap-2">
						{#each filteredSessions as session (session.session_id)}
							<ContextMenu.Root>
								<ContextMenu.Trigger>
									<div
										class="flex cursor-pointer items-center justify-between rounded-lg bg-muted/50 p-4 transition-colors hover:bg-muted/70"
									>
										<div class="flex flex-col gap-1">
											<span class="font-medium text-sm">
												{session.note || session.session_id}
											</span>
											<span class="text-xs text-muted-foreground"
												>{session.session_id}</span
											>
										</div>
										{#if session.workspace_path}
											<div class="flex flex-col items-end gap-1">
												<span class="text-xs text-muted-foreground">
													{session.workspace_path}
												</span>
											</div>
										{/if}
									</div>
								</ContextMenu.Trigger>
								<ContextMenu.Content>
									<ContextMenu.Item
										class="text-destructive focus:text-destructive"
										onclick={() => handleDeleteClick(session)}
									>
										{m.text_button_delete ? m.text_button_delete() : "Delete"}
									</ContextMenu.Item>
								</ContextMenu.Content>
							</ContextMenu.Root>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</section>

	<SandboxDeleteConfirmDialog
		bind:open={isDeleteDialogOpen}
		mode="local"
		session={targetSession}
	/>
</div>
