<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { cloudModeSessionsState } from "$lib/stores/code-agent/cloud-mode-sessions-state.svelte";
	import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { Loader2 } from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import { toast } from "svelte-sonner";

	const logger = createLogger("ui");

	interface Props {
		open?: boolean;
		threadId?: string;
		sandboxId?: string;
		sessionId?: string;
		onClose?: () => void;
		onConfirm?: (deleteRemoteSession: boolean) => Promise<void>;
	}

	let {
		open = $bindable(false),
		threadId: _threadId = "",
		sandboxId = "",
		sessionId = "",
		onClose = () => {},
		onConfirm = async () => {},
	}: Props = $props();

	let isDeleting = $state(false);
	let deleteRemoteSession = $state(false);

	// Reset checkbox when dialog opens
	$effect(() => {
		if (open) {
			deleteRemoteSession = false;
		}
	});

	async function handleDelete() {
		isDeleting = true;
		try {
			// If checkbox is checked and we have sandbox/session info, delete the session first
			if (deleteRemoteSession && sandboxId && sessionId) {
				let success: boolean;
				if (sandboxId === "local") {
					if (!localEnvState.sandboxRunning) {
						toast.error(m.code_agent_local_container_not_started());
						return;
					}
					success = await localClaudeCodeSandboxState.deleteSession(sessionId);
				} else if (sandboxId === "cloud") {
					if (cloudModeState.state.status !== "running") {
						toast.error(m.code_agent_cloud_instance_not_running());
						return;
					}
					success = await cloudModeSessionsState.deleteSession(sessionId);
				} else {
					success = await claudeCodeSandboxState.deleteSession(sandboxId, sessionId);
				}
				if (!success) {
					logger.error("Failed to delete session, but continuing with thread deletion");
				}
			}

			// Call the confirm callback to delete the thread
			await onConfirm(deleteRemoteSession);
			open = false;
		} finally {
			isDeleting = false;
		}
	}

	function handleCancel() {
		open = false;
		onClose();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="min-w-[480px] rounded-2xl p-6">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-lg font-semibold text-foreground">
				{m.title_delete_thread()}
			</h2>
		</div>

		<!-- Confirmation View -->
		<div class="space-y-4">
			<p class="text-sm text-foreground">
				{m.text_delete_thread_confirm()}
			</p>

			{#if sandboxId && sessionId}
				<div
					class="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg border border-border"
				>
					<Checkbox
						id="delete-remote"
						bind:checked={deleteRemoteSession}
						disabled={isDeleting}
						class="border-2 border-foreground/20 data-[state=checked]:border-destructive data-[state=checked]:bg-destructive"
					/>
					<label
						for="delete-remote"
						class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 select-none cursor-pointer"
					>
						{m.checkbox_delete_sandbox_session()}
					</label>
				</div>
			{/if}
		</div>

		<!-- Footer Buttons -->
		<div class="flex justify-between">
			<Button variant="outline" onclick={handleCancel} disabled={isDeleting}>
				{m.text_button_cancel()}
			</Button>
			<Button variant="destructive" onclick={handleDelete} disabled={isDeleting}>
				{#if isDeleting}
					<Loader2 class=" h-4 w-4 animate-spin" />
				{/if}
				{m.label_button_confirm()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
