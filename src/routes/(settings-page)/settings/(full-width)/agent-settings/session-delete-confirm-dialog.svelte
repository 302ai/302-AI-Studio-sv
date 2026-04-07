<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { Loader2 } from "@lucide/svelte";

	interface Props {
		open?: boolean;
		sandboxId?: string;
		sessionId?: string;
		remark?: string;
		onClose?: () => void;
		onConfirm?: () => Promise<void>;
	}

	let {
		open = $bindable(false),
		sandboxId = "",
		sessionId = "",
		remark = "",
		onClose = () => {},
		onConfirm = async () => {},
	}: Props = $props();

	let isDeleting = $state(false);

	async function handleDelete() {
		isDeleting = true;
		try {
			// Call the deleteSession method with sandboxId and sessionId
			const success = await claudeCodeSandboxState.deleteSession(sandboxId, sessionId);
			if (success) {
				await onConfirm();
				open = false;
			}
		} finally {
			isDeleting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="min-w-[568px] rounded-2xl p-6">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-lg font-semibold text-foreground">
				{m.title_delete_session()}
			</h2>
		</div>

		<!-- Confirmation View -->
		<div class="space-y-4">
			<div class="space-y-1">
				<p class="text-sm text-foreground">
					{m.label_remark ? m.label_remark() : "备注"}：{remark || m.remark_null()}
				</p>
				<p class="text-sm text-foreground">
					ID：<span class="font-bold">{sessionId}</span>
				</p>
			</div>

			<p class="text-sm text-destructive">* {m.text_delete_session_warning_confirm()}</p>
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
