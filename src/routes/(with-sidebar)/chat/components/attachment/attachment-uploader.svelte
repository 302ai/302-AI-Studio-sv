<script lang="ts" module>
	export const MAX_ATTACHMENT_COUNT = 5;
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { Paperclip } from "@lucide/svelte";
	import type { AttachmentFile } from "@shared/types";
	import { nanoid } from "nanoid";

	let isMaxReached = $derived(chatState.attachments.length >= MAX_ATTACHMENT_COUNT);
	let fileInput: HTMLInputElement;

	async function generatePreview(file: File): Promise<string | undefined> {
		if (file.type.startsWith("image/")) {
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

			const preview = await generatePreview(file);

			// 获取文件的系统路径
			const filePath = (file as File & { path?: string }).path || file.name;

			const attachment: AttachmentFile = {
				id: nanoid(),
				name: file.name,
				type: file.type,
				size: file.size,
				file: file,
				preview,
				filePath,
			};

			newAttachments.push(attachment);
		}

		chatState.addAttachments(newAttachments);
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
	accept="image/*,text/*,audio/*,video/*,.pdf,.doc,.docx,.json,.csv,.xlsx,.xls"
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
