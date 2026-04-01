<script lang="ts">
	import { uploadAttachments, type Attachment } from "$lib/api/vibe-mode";
	import { ViewerPanel } from "$lib/components/buss/viewer/index.js";
	import {
		formatFileSize,
		getFileIcon,
		shouldShowPreviewAsThumbnail,
	} from "$lib/components/buss/viewer/viewer-utils.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Textarea } from "$lib/components/ui/textarea";
	import * as m from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { cn } from "$lib/utils.js";
	import { generateFilePreview, MAX_ATTACHMENT_COUNT } from "$lib/utils/file-preview";
	import { Eye, Loader, Paperclip, Sparkles, Trash2 } from "@lucide/svelte";
	import type { AttachmentFile } from "@shared/types";
	import { nanoid } from "nanoid";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { SvelteMap } from "svelte/reactivity";
	import ButtonWithTooltip from "../button-with-tooltip/button-with-tooltip.svelte";
	import CompactNumberInput from "./compact-number-input.svelte";
	import TaskDecomposeDialog from "./task-decompose-dialog.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	const { onShortcutAction } = window.electronAPI.shortcut;

	// Local UI state
	let attachmentLoadingMap = new SvelteMap<string, boolean>();
	let textareaRef = $state<HTMLTextAreaElement | null>(null);
	let fileInputRef = $state<HTMLInputElement | null>(null);
	let selectedAttachment = $state<AttachmentFile | null>(null);
	let isAdding = $state(false);
	let decomposeDialogOpen = $state(false);

	function handleDecomposeResult(tasks: string[]) {
		codeAgentTaskboardState.addMultipleTasks(tasks);
	}

	function normalizeRepeatNumber(value: string): number {
		const n = Number.parseInt(value, 10);
		return Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1;
	}

	function isAttachmentLoading(id: string): boolean {
		return attachmentLoadingMap.get(id) ?? false;
	}

	function setAttachmentLoading(id: string, loading: boolean) {
		attachmentLoadingMap.set(id, loading);
	}

	function openViewer(attachment: AttachmentFile) {
		if (isAttachmentLoading(attachment.id)) return;
		selectedAttachment = attachment;
	}

	function closeViewer() {
		selectedAttachment = null;
	}

	function fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				// 保留完整的 data:xxx;base64,xxx 格式
				resolve(result);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function handleAdd() {
		const attachments = codeAgentTaskboardState.attachments;

		// 如果有附件，处理上传
		if (attachments.length > 0) {
			const sandboxId = codeAgentState.sandboxId;
			const cwd = codeAgentState.currentWorkspacePath;

			if (!sandboxId || !cwd) {
				// 沙盒未初始化，将附件添加到待上传队列
				codeAgentTaskboardState.addPendingAttachments([...attachments]);
			} else {
				// 沙盒已初始化，直接上传
				isAdding = true;
				try {
					const attachmentList: Attachment[] = await Promise.all(
						attachments.map(async (att) => ({
							filename: att.name,
							content: att.file ? await fileToBase64(att.file) : "",
						})),
					);

					const result = await uploadAttachments(sandboxId, cwd, attachmentList);
					if (!result.isOk) {
						toast.error(m.taskboard_error_attachment_upload_failed());
						return;
					}
				} catch (error) {
					logger.error("Failed to upload attachments:", error);
					toast.error(m.taskboard_error_attachment_upload_failed());
					return;
				} finally {
					isAdding = false;
				}
			}
		}

		codeAgentTaskboardState.repeatCount = normalizeRepeatNumber(
			`${codeAgentTaskboardState.repeatCount}`,
		);
		codeAgentTaskboardState.addTaskFromInput();
	}

	// Listen for sendMessage shortcut action (Enter key)
	// This is needed because before-input-event blocks DOM keydown events
	onMount(() => {
		const unsub = onShortcutAction((action) => {
			if (action.action === "sendMessage" && textareaRef === document.activeElement) {
				handleAdd();
			}
		});
		return () => unsub();
	});

	function handleAttachmentClick() {
		fileInputRef?.click();
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (!files) return;

		await processFiles(Array.from(files));
		input.value = "";
	}

	async function processFiles(files: File[], fromPaste = false) {
		for (const file of files) {
			if (codeAgentTaskboardState.attachments.length >= MAX_ATTACHMENT_COUNT) {
				toast.warning(`已达到最大附件数量：${MAX_ATTACHMENT_COUNT}`);
				break;
			}

			const attachmentId = nanoid();
			const filePath = (file as File & { path?: string }).path || file.name;

			// 为粘贴的文件添加时间戳以区分
			const fileName = fromPaste
				? generatePastedFileName(file.name || `file-${Date.now()}`)
				: file.name || `file-${Date.now()}`;

			const attachment: AttachmentFile = {
				id: attachmentId,
				name: fileName,
				type: file.type,
				size: file.size,
				file,
				preview: undefined,
				filePath,
			};

			codeAgentTaskboardState.addAttachment(attachment);
			setAttachmentLoading(attachmentId, true);

			generateFilePreview(file).then((preview) => {
				codeAgentTaskboardState.updateAttachment(attachmentId, { preview });
				setAttachmentLoading(attachmentId, false);
			});
		}
	}

	async function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];
		for (const item of Array.from(items)) {
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file) files.push(file);
			}
		}

		if (files.length === 0) return;
		event.preventDefault();
		await processFiles(files, true);
	}

	function generatePastedFileName(originalName: string): string {
		const timestamp = Date.now();
		const lastDotIndex = originalName.lastIndexOf(".");
		if (lastDotIndex === -1) {
			return `${originalName}-${timestamp}`;
		}
		const name = originalName.slice(0, lastDotIndex);
		const ext = originalName.slice(lastDotIndex);
		return `${name}-${timestamp}${ext}`;
	}
</script>

<div class="p-3 pb-1">
	<!-- Attachment previews above input -->
	{#if codeAgentTaskboardState.attachments.length > 0}
		<div class="flex gap-2 pb-2">
			{#each codeAgentTaskboardState.attachments as attachment (attachment.id)}
				{@const isLoading = isAttachmentLoading(attachment.id)}
				<div class="group relative overflow-hidden rounded-lg border border-border">
					<button
						class={cn(
							"relative size-14",
							"flex items-center justify-center",
							attachment.preview && shouldShowPreviewAsThumbnail(attachment) ? "" : "bg-muted",
							isLoading && "cursor-wait",
						)}
						onclick={() => openViewer(attachment)}
						disabled={isLoading}
					>
						{#if attachment.preview && shouldShowPreviewAsThumbnail(attachment)}
							<img
								src={attachment.preview}
								alt={attachment.name}
								class={cn("h-full w-full object-cover", isLoading && "opacity-50")}
							/>
						{:else}
							{@const IconComponent = getFileIcon(attachment)}
							<div
								class={cn(
									"flex h-full w-full flex-col items-center justify-center gap-y-1 px-0.5 text-muted-foreground",
									isLoading && "opacity-50",
								)}
							>
								<IconComponent class="size-6" />
								<span class="max-w-full truncate text-xs leading-none">
									{attachment.name}
								</span>
							</div>
						{/if}

						{#if isLoading}
							<div class="absolute inset-0 flex items-center justify-center bg-background/50">
								<Loader class="size-5 animate-spin" />
							</div>
						{/if}
					</button>

					{#if !isLoading}
						<div
							class={cn(
								"pointer-events-none absolute inset-0 bg-black/70 text-white",
								"flex flex-col items-center justify-center",
								"opacity-0 transition-opacity duration-200 group-hover:opacity-100",
							)}
						>
							<Eye class="size-4" />
							<div class="absolute right-0 bottom-0 left-0 px-1.5 text-center text-xs">
								{formatFileSize(attachment.size)}
							</div>
						</div>
					{/if}

					{#if !isLoading}
						<button
							onclick={() => codeAgentTaskboardState.removeAttachment(attachment.id)}
							class="pointer-events-auto absolute top-0.5 right-0 size-4 text-destructive opacity-0 group-hover:opacity-100 cursor-pointer"
						>
							<Trash2 class="size-3.5 hover:text-destructive/80" />
						</button>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Input box -->
	<div
		class={cn(
			"flex flex-col rounded-xl border p-3 pb-0",
			"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
			"bg-input",
		)}
	>
		<!-- Text input area -->
		<div class="min-h-0 flex-1">
			<Textarea
				bind:ref={textareaRef}
				class={cn(
					"w-full min-h-[36px] max-h-[120px] resize-none p-0",
					"border-none shadow-none focus-within:ring-0 focus-within:outline-hidden focus-visible:ring-0",
				)}
				placeholder={m.taskboard_input_placeholder()}
				bind:value={codeAgentTaskboardState.inputValue}
				onpaste={handlePaste}
			/>
		</div>

		<input
			type="file"
			multiple
			class="hidden"
			bind:this={fileInputRef}
			onchange={handleFileSelect}
		/>

		<!-- Bottom action bar -->
		<div class="my-1 flex items-center justify-between">
			<!-- Left: Attachment button -->
			<div class="flex items-center gap-1">
				<ButtonWithTooltip
					tooltip={m.title_upload_attachment()}
					class="hover:!bg-chat-action-hover"
					onclick={handleAttachmentClick}
					size="icon-sm"
				>
					<Paperclip class="size-4" />
				</ButtonWithTooltip>

				<CompactNumberInput bind:count={codeAgentTaskboardState.repeatCount} />
			</div>

			<!-- Right: Decompose and Add button -->
			<div class="flex items-center gap-1">
				<ButtonWithTooltip
					tooltip={m.taskboard_auto_decompose()}
					class=" hover:!bg-chat-action-hover"
					onclick={() => (decomposeDialogOpen = true)}
					size="icon-sm"
				>
					<Sparkles class="size-4 text-purple-500" />
				</ButtonWithTooltip>

				<Button variant="default" size="sm" onclick={handleAdd} disabled={isAdding}>
					{#if isAdding}
						<Loader class="h-4 w-4 animate-spin mr-2" />
					{/if}
					{m.taskboard_button_add()}
				</Button>
			</div>
		</div>
	</div>
</div>

<!-- Viewer Panel Modal -->
{#if selectedAttachment}
	<ViewerPanel
		attachment={selectedAttachment}
		isOpen={selectedAttachment !== null}
		onClose={closeViewer}
	/>
{/if}

<!-- Task Decompose Dialog -->
<TaskDecomposeDialog
	bind:open={decomposeDialogOpen}
	initialRequirement={codeAgentTaskboardState.inputValue}
	onDecompose={handleDecomposeResult}
/>
