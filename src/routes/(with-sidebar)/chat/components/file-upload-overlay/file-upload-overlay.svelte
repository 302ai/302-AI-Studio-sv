<script lang="ts">
	import FileUploadIcon from "$lib/assets/icons/ai-application/File-Upload.svg";
	import { m } from "$lib/paraglide/messages.js";
	import {
		MAX_ATTACHMENT_COUNT,
		MAX_FILE_SIZE_BYTES,
		MAX_FILE_SIZE_MB,
	} from "$lib/utils/file-preview";
	import type { AttachmentFile } from "@shared/types";
	import { nanoid } from "nanoid";
	import { toast } from "svelte-sonner";
	import { fade } from "svelte/transition";

	interface Props {
		onFilesAdded: (files: AttachmentFile[]) => void;
		currentAttachmentCount: number;
	}

	let { onFilesAdded, currentAttachmentCount }: Props = $props();

	let showOverlay = $state(false);
	let isReady = $state(false);

	// 添加延迟以防止在页面过渡/动画期间触发 overlay
	$effect(() => {
		const timer = setTimeout(() => {
			isReady = true;
		}, 500); // 等待页面过渡动画完成

		return () => clearTimeout(timer);
	});

	async function processFiles(files: File[]) {
		for (const file of files) {
			if (currentAttachmentCount >= MAX_ATTACHMENT_COUNT) {
				toast.warning(m.toast_max_attachments_reached());
				break;
			}

			const filePath = (file as File & { path?: string }).path || file.name;
			const attachmentId = nanoid();

			// 立即创建附件对象并添加到列表
			const attachment: AttachmentFile = {
				id: attachmentId,
				name: file.name || `file-${Date.now()}`,
				type: file.type,
				size: file.size,
				file,
				preview: undefined, // 预览稍后异步生成
				filePath,
			};

			// 通知父组件添加附件（立即显示）
			onFilesAdded([attachment]);
		}
	}

	// function handleDragEnter(event: DragEvent) {
	// 	event.preventDefault();
	// 	// 只有在组件完全准备好后才显示 overlay
	// 	if (isReady && event.dataTransfer?.types.includes("Files")) {
	// 		showOverlay = true;
	// 	}
	// }

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = "none";
		}
	}

	function handleDragLeave(event: DragEvent) {
		// 检查是否真的离开了窗口区域
		const target = event.target as HTMLElement;
		if (target === document.body || !event.relatedTarget) {
			showOverlay = false;
		}
	}

	function handleWindowDrop(event: DragEvent) {
		event.preventDefault();
		showOverlay = false;
	}

	// 在组件挂载时添加全局事件监听
	$effect(() => {
		const handleGlobalDragEnter = (event: DragEvent) => {
			if (isReady && event.dataTransfer?.types.includes("Files")) {
				showOverlay = true;
			}
		};

		const handleGlobalDragOver = (event: DragEvent) => {
			event.preventDefault();
		};

		const handleGlobalDrop = (event: DragEvent) => {
			event.preventDefault();
			showOverlay = false;
		};

		const handleGlobalDragLeave = (event: DragEvent) => {
			// 只有当拖拽离开窗口时才隐藏
			if (!event.relatedTarget) {
				showOverlay = false;
			}
		};

		window.addEventListener("dragenter", handleGlobalDragEnter);
		window.addEventListener("dragover", handleGlobalDragOver);
		window.addEventListener("drop", handleGlobalDrop);
		window.addEventListener("dragleave", handleGlobalDragLeave);

		return () => {
			window.removeEventListener("dragenter", handleGlobalDragEnter);
			window.removeEventListener("dragover", handleGlobalDragOver);
			window.removeEventListener("drop", handleGlobalDrop);
			window.removeEventListener("dragleave", handleGlobalDragLeave);
		};
	});

	function handleDialogDragOver(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = "copy";
		}
	}

	function handleDialogDrop(event: DragEvent) {
		event.preventDefault();
		event.stopPropagation();
		showOverlay = false;

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const fileArray = Array.from(files);

		// 验证文件数量
		if (fileArray.length > MAX_ATTACHMENT_COUNT) {
			toast.warning(m.toast_file_count_exceeded({ count: MAX_ATTACHMENT_COUNT }));
			return;
		}

		// 验证文件大小
		const oversizedFiles = fileArray.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
		if (oversizedFiles.length > 0) {
			toast.warning(m.toast_file_size_exceeded({ size: MAX_FILE_SIZE_MB }));
			return;
		}

		processFiles(fileArray);
	}

	export function resetOverlay() {
		showOverlay = false;
		isReady = false;
		// 重置后需要重新等待
		setTimeout(() => {
			isReady = true;
		}, 500);
	}
</script>

{#if showOverlay}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center"
		style="background-color: rgba(0, 0, 0, 0.6); position: fixed; top: 0; left: 0; right: 0; bottom: 0;"
		transition:fade={{ duration: 150 }}
		ondragover={handleDragOver}
		ondrop={handleWindowDrop}
		ondragleave={handleDragLeave}
		role="presentation"
	>
		<div
			class="flex flex-col items-center justify-center gap-6 rounded-3xl bg-background shadow-2xl"
			style="width: 560px; height: 284px;"
			ondragover={handleDialogDragOver}
			ondrop={handleDialogDrop}
			ondragleave={(e) => e.stopPropagation()}
			role="button"
			tabindex="0"
		>
			<div
				class="w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg"
			>
				<img src={FileUploadIcon} alt="Upload" class="w-10 h-10" />
			</div>
			<div class="space-y-2 text-center">
				<h3 class="text-lg font-medium text-foreground">{m.text_drag_files_here()}</h3>
				<p class="text-sm text-muted-foreground">
					{m.text_drag_files_subtitle()}
				</p>
			</div>
		</div>
	</div>
{/if}
