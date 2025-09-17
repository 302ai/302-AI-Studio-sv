<script lang="ts" module>
	type ActionType = "copy" | "regenerate" | "edit";

	interface Props {
		message: ChatMessage;
		enabledActions?: ActionType[];
	}
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { CopyButton } from "$lib/components/buss/copy-button";
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog";
	import { Textarea } from "$lib/components/ui/textarea";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import type { ChatMessage } from "$lib/types/chat";
	import { RefreshCcw, SquarePen } from "@lucide/svelte";

	let { message, enabledActions = ["copy", "regenerate", "edit"] }: Props = $props();

	let isEditDialogOpen = $state(false);
	let editContent = $state("");

	function handleEditClick() {
		editContent = message.content;
		isEditDialogOpen = true;
	}

	function handleEditCancel() {
		isEditDialogOpen = false;
		editContent = "";
	}

	function handleEditConfirm() {
		chatState.updateMessage(message.id, editContent.trim());
		isEditDialogOpen = false;
		editContent = "";
	}

	function handleRegenerate() {
		// TODO: 实现重新生成功能
		console.log("Regenerate message:", message.id);
	}
</script>

{#snippet actionCopy()}
	<CopyButton content={message.content} />
{/snippet}

{#snippet actionRegenerate()}
	<ButtonWithTooltip
		tooltipSide="bottom"
		class="text-muted-foreground hover:!bg-chat-action-hover"
		tooltip={m.title_regenerate()}
		onclick={handleRegenerate}
	>
		<RefreshCcw />
	</ButtonWithTooltip>
{/snippet}

{#snippet actionEdit()}
	<Dialog.Root bind:open={isEditDialogOpen}>
		<ButtonWithTooltip
			tooltipSide="bottom"
			class="text-muted-foreground hover:!bg-chat-action-hover"
			tooltip={m.title_edit()}
			onclick={handleEditClick}
		>
			<Dialog.Trigger>
				<SquarePen />
			</Dialog.Trigger>
		</ButtonWithTooltip>
		<Dialog.Content class="p-4">
			<Dialog.Header>
				<Dialog.Title>{m.text_edit()}</Dialog.Title>
			</Dialog.Header>

			<Textarea
				bind:value={editContent}
				rows={8}
				class="max-h-128 min-h-40 w-[512px] resize-none border-border"
			/>

			<Dialog.Footer class="flex !justify-between">
				<Button
					variant="outline"
					onclick={handleEditCancel}
					class="!border-border hover:!border-border/80"
				>
					{m.text_button_cancel()}
				</Button>
				<div class="flex gap-2">
					{#if message.role === "user"}
						<Button variant="secondary" onclick={handleRegenerate}>
							{m.title_regenerate()}
						</Button>
					{/if}
					<Button
						variant="default"
						onclick={handleEditConfirm}
						disabled={editContent.trim() === message.content}
					>
						{m.text_button_confirm_edit()}
					</Button>
				</div>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/snippet}

<div class="flex items-center gap-2">
	{#each enabledActions as action (action)}
		{#if action === "copy"}
			{@render actionCopy()}
		{:else if action === "regenerate"}
			{@render actionRegenerate()}
		{:else if action === "edit"}
			{@render actionEdit()}
		{/if}
	{/each}
</div>
