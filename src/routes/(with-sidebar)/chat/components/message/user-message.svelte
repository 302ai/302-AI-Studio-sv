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
	import type { ChatMessage } from "$lib/types/chat";
	import type { AttachmentFile } from "@shared/types";
	import MessageActions from "./message-actions.svelte";
	import MessageAttachment from "./message-attachment.svelte";

	let { message }: Props = $props();
	let selectedAttachment = $state<AttachmentFile | null>(null);

	const attachments = $derived<AttachmentFile[]>(
		(message.metadata?.attachments || []).map((att) => ({
			id: att.id,
			name: att.name,
			type: att.type,
			size: att.size,
			filePath: att.filePath,
			preview: att.preview,
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
</script>

{#snippet messageFooter()}
	<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100">
		<MessageActions {message} enabledActions={["edit"]} />
	</div>
{/snippet}

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

		<div>
			{#each displayParts as part, partIndex (partIndex)}
				{#if part.type === "text"}
					<div>{part.text}</div>
				{/if}
			{/each}
		</div>
	</div>

	{@render messageFooter()}
</div>

<!-- Viewer Panel Modal -->
{#if selectedAttachment}
	<ViewerPanel
		attachment={selectedAttachment}
		isOpen={selectedAttachment !== null}
		onClose={closeViewer}
	/>
{/if}
