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
	import { ChevronDown } from "@lucide/svelte";
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
	let isExpanded = $state(false);
	let messageContentElement: HTMLDivElement | null = $state(null);
	let needsCollapse = $state(false);

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

	// Check if there's any text content to display (excluding empty strings)
	const hasDisplayableText = $derived(
		displayParts.some((part) => part.type === "text" && part.text.trim().length > 0),
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

	function linkifyText(text: string): string {
		const urlRegex =
			/(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*))/gi;

		const parts: Array<{ type: "text" | "url"; value: string }> = [];
		let lastIndex = 0;
		let match;

		while ((match = urlRegex.exec(text)) !== null) {
			if (match.index > lastIndex) {
				parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
			}
			parts.push({ type: "url", value: match[0] });
			lastIndex = match.index + match[0].length;
		}

		if (lastIndex < text.length) {
			parts.push({ type: "text", value: text.slice(lastIndex) });
		}

		return parts
			.map((part) => {
				if (part.type === "url") {
					const escaped = part.value
						.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.replace(/"/g, "&quot;")
						.replace(/'/g, "&#039;");
					return `<a href="${escaped}" class="text-blue-500 underline hover:text-blue-600 cursor-pointer">${escaped}</a>`;
				} else {
					return part.value
						.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.replace(/"/g, "&quot;")
						.replace(/'/g, "&#039;");
				}
			})
			.join("");
	}

	function handleLinkClick(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			const target = event.target as HTMLElement;
			if (target.tagName === "A") {
				event.preventDefault();

				const url = (target as HTMLAnchorElement).href;
				if (url && window.electronAPI?.externalLinkService?.openExternalLink) {
					window.electronAPI.externalLinkService.openExternalLink(url);
				}
			}
		};

		node.addEventListener("click", handleClick);

		return {
			destroy() {
				node.removeEventListener("click", handleClick);
			},
		};
	}

	function checkLineCount(node: HTMLDivElement) {
		messageContentElement = node;

		// Check if content exceeds 3 lines
		const checkHeight = () => {
			if (!node) return;

			// Get line height
			const lineHeight = parseFloat(window.getComputedStyle(node).lineHeight);
			const actualHeight = node.scrollHeight;
			const lines = Math.round(actualHeight / lineHeight);

			needsCollapse = lines > 3;
		};

		// Check immediately and on resize
		checkHeight();
		window.addEventListener("resize", checkHeight);

		return {
			destroy() {
				window.removeEventListener("resize", checkHeight);
			},
		};
	}

	function toggleExpand() {
		isExpanded = !isExpanded;
	}
</script>

{#snippet messageFooter()}
	<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100">
		<MessageActions {message} enabledActions={["edit"]} />
	</div>
{/snippet}

<MessageContextMenu onCopy={handleCopyMessage} onEdit={handleEditClick} onDelete={handleDelete}>
	<div class="group flex flex-col items-end gap-2">
		{#if attachments.length > 0}
			<div class="flex max-w-[80%] flex-wrap gap-2">
				{#each attachments as attachment (attachment.id)}
					<MessageAttachment {attachment} {openViewer} />
				{/each}
			</div>
		{/if}

		{#if hasDisplayableText}
			<div
				class="relative max-w-[80%] rounded-lg bg-chat-user-message-bg px-4 py-2 text-chat-user-message-fg"
			>
				<div
					class="whitespace-pre-wrap break-all overflow-hidden transition-all duration-300 {needsCollapse &&
					!isExpanded
						? 'max-h-[4.5em]'
						: ''}"
					use:handleLinkClick
					use:checkLineCount
				>
					{#each displayParts as part, partIndex (partIndex)}
						{#if part.type === "text"}
							<!-- eslint-disable svelte/no-at-html-tags -->
							<div>{@html linkifyText(part.text)}</div>
							<!-- eslint-enable svelte/no-at-html-tags -->
						{/if}
					{/each}
				</div>

				{#if needsCollapse && !isExpanded}
					<!-- Gradient overlay -->
					<div
						class="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-chat-user-message-bg to-transparent"
					></div>

					<!-- Expand button - positioned absolutely at bottom center -->
					<div class="absolute bottom-2 left-0 right-0 flex justify-center">
						<button
							type="button"
							onclick={toggleExpand}
							class="relative z-10 flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs text-primary shadow-md backdrop-blur-sm transition-all hover:shadow-lg dark:bg-[#8334EF] dark:text-white dark:hover:bg-[#7029d6]"
						>
							<span>{m.text_expand()}</span>
							<ChevronDown class="h-3 w-3" />
						</button>
					</div>
				{/if}

				{#if needsCollapse && isExpanded}
					<!-- Collapse button -->
					<div class="flex justify-center pt-2">
						<button
							type="button"
							onclick={toggleExpand}
							class="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs text-primary shadow-md backdrop-blur-sm transition-all hover:shadow-lg dark:bg-[#8334EF] dark:text-white dark:hover:bg-[#7029d6]"
						>
							<span>{m.text_collapse()}</span>
							<ChevronDown class="h-3 w-3 rotate-180" />
						</button>
					</div>
				{/if}
			</div>
		{/if}
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
