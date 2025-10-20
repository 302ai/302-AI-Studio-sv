<script lang="ts" module>
	export type UserMessage = ChatMessage & {
		role: "user";
	};

	interface Props {
		message: UserMessage;
	}
</script>

<script lang="ts">
	import { ViewerPanel } from "$lib/components/buss/viewer/index.js";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import type { ChatMessage } from "$lib/types/chat";
	import type { AttachmentFile } from "@shared/types";
	import { toast } from "svelte-sonner";
	import MessageActions from "./message-actions.svelte";
	import MessageAttachment from "./message-attachment.svelte";
	import MessageContextMenu from "./message-context-menu.svelte";
	import MessageEditDialog from "./message-edit-dialog.svelte";

	let { message }: Props = $props();
	let selectedAttachment = $state<AttachmentFile | null>(null);
	let isEditDialogOpen = $state(false);
	let editContent = $state("");

	async function handleCopy(content: string) {
		try {
			await navigator.clipboard.writeText(content);
			toast.success(m.toast_copied_success());
		} catch {
			toast.error(m.toast_copied_failed());
		}
	}

	const attachments = $derived<AttachmentFile[]>(
		(message.metadata?.attachments || []).map((att) => ({
			id: att.id,
			name: att.name,
			type: att.type,
			size: att.size,
			filePath: att.filePath,
			preview: att.preview,
			textContent: att.textContent,
			file: new File([], att.name, { type: att.type }),
		})),
	);

	const displayParts = $derived(
		message.parts.filter((part, index) => {
			if (part.type !== "text") return true;
			const fileContentIndex = message.metadata?.fileContentPartIndex;
			return fileContentIndex === undefined || index !== fileContentIndex;
		}),
	);

	function openViewer(attachment: AttachmentFile) {
		selectedAttachment = attachment;
	}

	function closeViewer() {
		selectedAttachment = null;
	}

	function getMessageContent(): string {
		return displayParts
			.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join("");
	}

	function handleCopyMessage() {
		const textContent = getMessageContent();
		if (textContent) {
			handleCopy(textContent);
		}
	}

	function handleEditClick() {
		editContent = getMessageContent();
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
		if (isEditDialogOpen && editContent.trim() !== getMessageContent()) {
			chatState.updateMessage(message.id, editContent.trim());
			isEditDialogOpen = false;
			editContent = "";
		}

		chatState.regenerateMessage(message.id);
	}

	function handleContentChange(value: string) {
		editContent = value;
	}

	function handleDelete() {
		chatState.deleteMessage(message.id);
	}
</script>

{#snippet messageFooter()}
	<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100">
		<MessageActions {message} enabledActions={["edit"]} />
	</div>
{/snippet}

<MessageContextMenu onCopy={handleCopyMessage} onEdit={handleEditClick} onDelete={handleDelete}>
	<div class="group flex flex-col items-end gap-2">
		<div
			class="flex max-w-[80%] rounded-lg bg-chat-user-message-bg px-4 py-2 text-chat-user-message-fg"
		>
			{#if attachments.length > 0}
				<div class="space-y-2">
					{#each attachments as attachment (attachment.id)}
						<MessageAttachment {attachment} {openViewer} />
					{/each}
				</div>
			{/if}

			<div class="whitespace-pre-wrap">
				{#each displayParts as part, partIndex (partIndex)}
					{#if part.type === "text"}
						<div>{part.text}</div>
					{/if}
				{/each}
			</div>
		</div>
		{@render messageFooter()}
	</div>
</MessageContextMenu>

<MessageEditDialog
	bind:open={isEditDialogOpen}
	{editContent}
	originalContent={getMessageContent()}
	showRegenerateButton={true}
	onCancel={handleEditCancel}
	onConfirm={handleEditConfirm}
	onRegenerate={handleRegenerate}
	onContentChange={handleContentChange}
/>

<!-- Viewer Panel Modal -->
{#if selectedAttachment}
	<ViewerPanel
		attachment={selectedAttachment}
		isOpen={selectedAttachment !== null}
		onClose={closeViewer}
	/>
{/if}
