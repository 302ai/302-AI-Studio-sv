<script lang="ts" module>
	export const MAX_ATTACHMENT_COUNT = 5;
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { compressFile } from "$lib/utils/file-compressor";
	import { Paperclip } from "@lucide/svelte";
	import type { AttachmentFile } from "@shared/types";
	import { nanoid } from "nanoid";

	let isMaxReached = $derived(chatState.attachments.length >= MAX_ATTACHMENT_COUNT);
	let fileInput: HTMLInputElement;

	async function generatePreview(file: File): Promise<string | undefined> {
		if (file.type.startsWith("image/")) {
			try {
				// Compress image to ensure base64 size < 1MB before storage
				const compressedDataURL = await compressFile(file);
				return compressedDataURL;
			} catch (error) {
				console.error("[AttachmentUploader] Failed to compress image:", error);
				// Fallback to original if compression fails
				return new Promise((resolve) => {
					const reader = new FileReader();
					reader.onload = (e) => {
						resolve(e.target?.result as string);
					};
					reader.onerror = () => {
						resolve(undefined);
					};
					reader.readAsDataURL(file);
				});
			}
		}

		if (file.type.startsWith("video/")) {
			return new Promise((resolve) => {
				const video = document.createElement("video");
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");

				video.onloadeddata = () => {
					canvas.width = video.videoWidth;
					canvas.height = video.videoHeight;

					if (ctx) {
						ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
						const thumbnailUrl = canvas.toDataURL("image/jpeg");
						resolve(thumbnailUrl);
					} else {
						resolve(undefined);
					}

					URL.revokeObjectURL(video.src);
				};

				video.onerror = () => {
					try {
						resolve(URL.createObjectURL(file));
					} catch {
						resolve(undefined);
					}
				};

				video.src = URL.createObjectURL(file);
				video.currentTime = 0.1;
				video.load();
			});
		}

		// Generate data URL for PDF files
		if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
			return new Promise((resolve) => {
				const reader = new FileReader();
				reader.onload = (e) => {
					resolve(e.target?.result as string);
				};
				reader.onerror = () => {
					resolve(undefined);
				};
				reader.readAsDataURL(file);
			});
		}

		// Generate data URL for Office documents (Excel, Word, PowerPoint)
		if (
			file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
			file.type === "application/vnd.ms-excel" ||
			file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
			file.type === "application/msword" ||
			file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
			file.type === "application/vnd.ms-powerpoint" ||
			file.name.toLowerCase().endsWith(".xlsx") ||
			file.name.toLowerCase().endsWith(".xls") ||
			file.name.toLowerCase().endsWith(".docx") ||
			file.name.toLowerCase().endsWith(".doc") ||
			file.name.toLowerCase().endsWith(".pptx") ||
			file.name.toLowerCase().endsWith(".ppt")
		) {
			return new Promise((resolve) => {
				const reader = new FileReader();
				reader.onload = (e) => {
					resolve(e.target?.result as string);
				};
				reader.onerror = () => {
					resolve(undefined);
				};
				reader.readAsDataURL(file);
			});
		}

		return undefined;
	}

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;

		if (!files) return;

		const newAttachments: AttachmentFile[] = [];

		for (const file of Array.from(files)) {
			if (chatState.attachments.length + newAttachments.length >= MAX_ATTACHMENT_COUNT) {
				break;
			}

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

			newAttachments.push(attachment);

			chatState.addAttachment(attachment);
			chatState.setAttachmentLoading(attachmentId, true);

			generatePreview(file).then((preview) => {
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
