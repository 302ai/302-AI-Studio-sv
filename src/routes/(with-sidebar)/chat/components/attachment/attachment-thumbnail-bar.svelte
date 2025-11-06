<script lang="ts">
	import { ViewerPanel } from "$lib/components/buss/viewer/index.js";
	import {
		formatFileSize,
		getFileIcon,
		shouldShowPreviewAsThumbnail,
	} from "$lib/components/buss/viewer/viewer-utils.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { cn } from "$lib/utils";
	import { Eye, Loader, Trash2 } from "@lucide/svelte";
	import type { AttachmentFile } from "@shared/types";

	let attachments = $derived(chatState.attachments);
	let selectedAttachment = $state<AttachmentFile | null>(null);

	function handleRemove(id: string) {
		chatState.removeAttachment(id);
	}

	function openViewer(attachment: AttachmentFile) {
		const isLoading = chatState.isAttachmentLoading(attachment.id);
		if (isLoading) return;
		selectedAttachment = attachment;
	}

	function closeViewer() {
		selectedAttachment = null;
	}
</script>

{#if attachments.length > 0}
	<div class="flex gap-2 pb-2">
		{#each attachments as attachment (attachment.id)}
			{@const isLoading = chatState.isAttachmentLoading(attachment.id)}
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
						onclick={() => handleRemove(attachment.id)}
						class="pointer-events-auto absolute top-0.5 right-0 size-4 text-destructive opacity-0 group-hover:opacity-100"
					>
						<Trash2 class="size-3.5 hover:text-destructive/80" />
					</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}

<!-- Viewer Panel Modal -->
{#if selectedAttachment}
	<ViewerPanel
		attachment={selectedAttachment}
		isOpen={selectedAttachment !== null}
		onClose={closeViewer}
	/>
{/if}
