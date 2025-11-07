<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { generateFilePreview, MAX_ATTACHMENT_COUNT } from "$lib/utils/file-preview";
	import { Paperclip } from "@lucide/svelte";
	import type { AttachmentFile } from "@shared/types";
	import { nanoid } from "nanoid";

	let isMaxReached = $derived(chatState.attachments.length >= MAX_ATTACHMENT_COUNT);
	let fileInput: HTMLInputElement;

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;

		if (!files) return;

		const currentCount = chatState.attachments.length;
		const availableSlots = MAX_ATTACHMENT_COUNT - currentCount;

		if (availableSlots <= 0) {
			target.value = "";
			return;
		}

		// Take only the number of files that fit within the limit
		const filesToAdd = Array.from(files).slice(0, availableSlots);

		for (const file of filesToAdd) {
			const filePath = (file as File & { path?: string }).path || file.name;

			const attachmentId = nanoid();

			const attachment: AttachmentFile = {
				id: attachmentId,
				name: file.name,
				type: file.type,
				size: file.size,
				file: file,
				preview: undefined,
				filePath,
			};

			chatState.addAttachment(attachment);
			chatState.setAttachmentLoading(attachmentId, true);

			generateFilePreview(file).then((preview) => {
				chatState.updateAttachment(attachmentId, { preview });
				chatState.setAttachmentLoading(attachmentId, false);
			});
		}

		target.value = "";
	}

	function handleClick() {
		if (!isMaxReached) {
			fileInput?.click();
		}
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	multiple
	class="hidden"
	accept="image/*,text/*,audio/*,video/*,.pdf,.json,.csv,.xlsx,.xls,.docx,.doc,.pptx,.ppt"
	onchange={handleFileSelect}
/>

<ButtonWithTooltip
	class="hover:!bg-chat-action-hover"
	tooltip={`${m.title_upload_attachment()} (${chatState.attachments.length}/${MAX_ATTACHMENT_COUNT})`}
	disabled={isMaxReached}
	onclick={handleClick}
>
	<Paperclip />
</ButtonWithTooltip>
