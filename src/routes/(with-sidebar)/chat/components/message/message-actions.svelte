<script lang="ts" module>
	import type { ChatMessage } from "$lib/types/chat";

	type ActionType = "copy" | "regenerate" | "edit";

	interface Props {
		message: ChatMessage;
		enabledActions?: ActionType[];
	}
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { CopyButton } from "$lib/components/buss/copy-button";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { RefreshCcw, SquarePen } from "@lucide/svelte";
	import MessageEditDialog from "./message-edit-dialog.svelte";
	import { getAssistantMessageContent } from "./utils";

	let { message, enabledActions = ["copy", "regenerate", "edit"] }: Props = $props();

	let isEditDialogOpen = $state(false);
	let editContent = $state("");

	function getMessageContent(message: ChatMessage): string {
		return message.parts
			.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join("");
	}

	function handleEditClick() {
		editContent = getMessageContent(message);
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
		if (isEditDialogOpen && editContent.trim() !== getMessageContent(message)) {
			chatState.updateMessage(message.id, editContent.trim());
			isEditDialogOpen = false;
			editContent = "";
		}

		chatState.regenerateMessage(message.id);
	}

	function handleContentChange(value: string) {
		editContent = value;
	}
</script>

{#snippet actionCopy()}
	<CopyButton
		content={message.role === "assistant"
			? getAssistantMessageContent(message)
			: getMessageContent(message)}
	/>
{/snippet}

{#snippet actionRegenerate()}
	<ButtonWithTooltip
		tooltipSide="bottom"
		class="text-muted-foreground hover:!bg-chat-action-hover"
		tooltip={m.title_regenerate()}
		onclick={handleRegenerate}
		disabled={!chatState.canRegenerate || chatState.isStreaming}
	>
		<RefreshCcw class={chatState.isStreaming ? "animate-spin" : ""} />
	</ButtonWithTooltip>
{/snippet}

{#snippet actionEdit()}
	<ButtonWithTooltip
		tooltipSide="bottom"
		class="text-muted-foreground hover:!bg-chat-action-hover"
		tooltip={m.title_edit()}
		onclick={handleEditClick}
	>
		<SquarePen />
	</ButtonWithTooltip>
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

<MessageEditDialog
	bind:open={isEditDialogOpen}
	{editContent}
	originalContent={getMessageContent(message)}
	showRegenerateButton={message.role === "user"}
	onCancel={handleEditCancel}
	onConfirm={handleEditConfirm}
	onRegenerate={handleRegenerate}
	onContentChange={handleContentChange}
/>
