<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import {
		claudeCodeSandboxState,
		persistedClaudeCodeSandboxState,
	} from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { cloudModeSessionsState } from "$lib/stores/code-agent/cloud-mode-sessions-state.svelte";
	import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { formatDateTimeShort } from "$lib/utils/date-format";
	import { Loader2 } from "@lucide/svelte";
	import type {
		ClaudeCodeSandboxInfo,
		CodeAgentType,
		LocalSessionInfo,
	} from "@shared/storage/code-agent";
	import { toast } from "svelte-sonner";

	interface Props {
		open?: boolean;
		mode?: CodeAgentType;
		sandbox?: ClaudeCodeSandboxInfo | null;
		session?: LocalSessionInfo | null;
		onClose?: () => void;
		onSuccess?: () => void;
	}

	let {
		open = $bindable(false),
		mode = "remote",
		sandbox,
		session,
		onClose = () => {},
		onSuccess = () => {},
	}: Props = $props();

	let isDeleting = $state(false);
	let isLoading = $state(false);

	// Get the latest sessions from the persisted state (remote mode only)
	const sessions = $derived.by(() => {
		if (["local", "cloud"].includes(mode) || !sandbox) return [];
		const currentSandbox = persistedClaudeCodeSandboxState.current.find(
			(s) => s.sandboxId === sandbox.sandboxId,
		);
		return currentSandbox?.sessionInfos || [];
	});

	// Refresh sessions when dialog opens (remote mode only)
	$effect(() => {
		if (open && sandbox && mode === "remote") {
			(async () => {
				isLoading = true;
				try {
					await claudeCodeSandboxState.refreshSessions(sandbox.sandboxId);
				} finally {
					isLoading = false;
				}
			})();
		}
	});

	function formatTime(session: { usedAt?: string }) {
		return formatDateTimeShort(session.usedAt);
	}

	async function handleDelete() {
		isDeleting = true;
		try {
			if (mode === "local") {
				if (!session) return;
				if (!localEnvState.sandboxRunning) {
					toast.error(m.code_agent_local_container_not_started());
					return;
				}
				await localClaudeCodeSandboxState.deleteSession(session.session_id);
			} else if (mode === "remote") {
				if (!session) return;
				if (cloudModeState.state.status !== "running") {
					toast.error(m.code_agent_cloud_instance_not_running());
					return;
				}
				await cloudModeSessionsState.deleteSession(session.session_id);
			} else {
				if (!sandbox) return;
				await claudeCodeSandboxState.deleteSandbox(sandbox.sandboxId);
			}
			open = false;
			onSuccess();
		} finally {
			isDeleting = false;
		}
	}

	const isLocalOrCloud = $derived(["local", "cloud"].includes(mode));
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="min-w-[568px] rounded-2xl p-6">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-lg font-semibold text-foreg round">
				{#if isLocalOrCloud}
					{m.title_delete_session()}
				{:else}
					{m.title_delete_sandbox()}
				{/if}
			</h2>
		</div>

		<!-- Confirmation View -->
		<div class="space-y-4">
			{#if isLocalOrCloud}
				<!-- Local Mode: Session Info Only -->
				<div class="space-y-1">
					<p class="text-sm text-foreground">
						{m.title_delete_session_confirm({
							remark: session?.note || m.remark_null(),
						})}
					</p>
					<p class="text-sm text-foreground">
						{m.title_session_id()}：<span class="font-bold">{session?.session_id}</span>
					</p>
					{#if session?.workspace_path}
						<p class="text-sm text-foreground">
							{m.local_platform_work_directory()}：<span class="font-bold"
								>{session.workspace_path}</span
							>
						</p>
					{/if}
				</div>
				<p class="text-sm text-destructive">
					{m.text_delete_session_warning_confirm()}
				</p>
			{:else}
				<!-- Remote Mode: Sandbox + Sessions List -->
				<div class="space-y-1">
					<p class="text-sm text-foreground">
						{m.title_delete_sandbox_confirm({
							remark: sandbox?.sandboxRemark || m.remark_null(),
						})}
					</p>
					<p class="text-sm text-foreground">
						{m.title_sandbox_id()}：<span class="font-bold">{sandbox?.sandboxId}</span>
					</p>
				</div>

				<div class="space-y-2">
					<p class="text-sm font-bold mb-3 text-foreground">
						{m.text_delete_sandbox_warning()}
					</p>
					<div class="max-h-48 overflow-y-auto space-y-2 mb-4">
						{#if isLoading}
							<div class="flex items-center justify-center py-4">
								<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						{:else if sessions.length === 0}
							<p class="text-sm text-muted-foreground text-center py-4">
								{m.no_sessions()}
							</p>
						{:else}
							{#each sessions as session (session.sessionId)}
								<div
									class="flex items-center justify-between p-4 rounded-xl bg-muted/50"
								>
									<div>
										<p class="text-sm font-medium text-foreground">
											{session.note || session.sessionId}
										</p>
										<p class="text-xs text-muted-foreground">
											{session.sessionId}
										</p>
									</div>
									<span class="text-sm text-muted-foreground"
										>{formatTime(session)}</span
									>
								</div>
							{/each}
						{/if}
					</div>
				</div>

				<p class="text-sm text-destructive">
					{m.text_delete_sandbox_warning_confirm()}
				</p>
			{/if}
		</div>

		<!-- Footer Buttons -->
		<div class="flex justify-between">
			<Button
				variant="outline"
				onclick={() => {
					open = false;
					onClose();
				}}
				disabled={isDeleting}
			>
				{m.common_cancel()}
			</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={isDeleting}>
				{#if isDeleting}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				{m.title_button_delete()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
