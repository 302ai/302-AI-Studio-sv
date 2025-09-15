<script lang="ts" module>
	export type UserMessage = ChatMessage & {
		role: "user";
		attachments: AttachmentFile[];
	};

	interface Props {
		message: UserMessage;
	}
</script>

<script lang="ts">
	import { ViewerPanel } from "$lib/components/buss/viewer/index.js";
	import type { AttachmentFile, ChatMessage } from "$lib/types/chat";
	import MessageActions from "./message-actions.svelte";
	import MessageAttachment from "./message-attachment.svelte";

	const { message }: Props = $props();
	let selectedAttachment = $state<AttachmentFile | null>(null);

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
		class="bg-chat-user-message-bg text-chat-user-message-fg flex max-w-[80%] rounded-lg px-4 py-2"
	>
		{#if message.attachments.length > 0}
			<div class="space-y-2">
				{#each message.attachments as attachment (attachment.id)}
					<MessageAttachment {attachment} {openViewer} />
				{/each}
			</div>
		{/if}

		<span class="whitespace-pre-wrap">{message.content}</span>
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
