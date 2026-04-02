<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { fileToBase64 } from "$lib/stores/code-agent/utils";
	import { generateFilePreview, MAX_ATTACHMENT_COUNT } from "$lib/utils/file-preview";
	import { Paperclip } from "@lucide/svelte";
	import type { AttachmentFile } from "@shared/types";
	import { nanoid } from "nanoid";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	interface Props {
		disabled?: boolean;
	}
	let { disabled = false }: Props = $props();

	let maxAttachmentLimit = $derived(codeAgentState.enabled ? 20 : MAX_ATTACHMENT_COUNT);
	let isMaxReached = $derived(chatState.attachments.length >= maxAttachmentLimit);
	let fileInput: HTMLInputElement;

	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const files = target.files;

		if (!files) return;

		const currentCount = chatState.attachments.length;
		const availableSlots = maxAttachmentLimit - currentCount;

		if (availableSlots <= 0) {
			target.value = "";
			return;
		}

		// Take only the number of files that fit within the limit
		const filesToAdd = Array.from(files).slice(0, availableSlots);

		for (const file of filesToAdd) {
			const filePath = (file as File & { path?: string }).path || file.name;
			const attachmentId = nanoid();

			// 立即创建附件对象并添加到列表（preview 暂时为 undefined）
			const attachment: AttachmentFile = {
				id: attachmentId,
				name: file.name,
				type: file.type,
				size: file.size,
				file: file,
				preview: undefined, // 预览稍后异步生成
				filePath,
			};

			// 立即添加附件到状态，用户可以立即看到
			chatState.addAttachment(attachment);
			// 标记为加载中
			chatState.setAttachmentLoading(attachmentId, true);

			// 异步生成预览或读取完整内容（不阻塞 UI）
			const processFile = async () => {
				const isAbsolutePath =
					filePath.includes("/") ||
					filePath.includes("\\") ||
					/^[a-zA-Z]:/.test(filePath);

				if (!isAbsolutePath) {
					// 如果没有绝对路径，强制读取文件完整内容作为 preview
					// 这样 code-agent-send-message-button-state.ts 就能使用这个内容上传
					try {
						const content = await fileToBase64(file);
						chatState.updateAttachment(attachmentId, { preview: content });
					} catch (e) {
						logger.error("Failed to read file content:", e);
					}
				} else {
					// 正常的预览生成逻辑
					const preview = await generateFilePreview(file);
					chatState.updateAttachment(attachmentId, { preview });
				}

				// 标记加载完成
				chatState.setAttachmentLoading(attachmentId, false);
			};

			processFile();
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
	accept="image/*,text/*,audio/*,video/*,.pdf,.json,.csv,.xlsx,.xls,.docx,.doc,.pptx,.ppt,.md,.markdown,.zip"
	onchange={handleFileSelect}
/>

<ButtonWithTooltip
	class="hover:!bg-chat-action-hover"
	tooltip={`${m.title_upload_attachment()} (${chatState.attachments.length}/${maxAttachmentLimit})`}
	disabled={isMaxReached || disabled}
	onclick={handleClick}
>
	<Paperclip />
</ButtonWithTooltip>
