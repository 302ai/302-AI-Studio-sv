<script lang="ts">
	import { ViewerPanel } from "$lib/components/buss/viewer/index.js";
	import { formatFileSize, getFileIcon } from "$lib/components/buss/viewer/viewer-utils.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import type { AttachmentFile } from "$lib/types/chat";
	import { cn } from "$lib/utils";
	import { Eye, Trash2 } from "@lucide/svelte";

	const attachments = $derived(chatState.attachments);
	let selectedAttachment = $state<AttachmentFile | null>(null);

	function handleRemove(id: string) {
		chatState.removeAttachment(id);
	}

	function openViewer(attachment: AttachmentFile) {
		selectedAttachment = attachment;
	}

	function closeViewer() {
		selectedAttachment = null;
	}
</script>

{#if attachments.length > 0}
	<div class="flex gap-2 pb-2">
		{#each attachments as attachment (attachment.id)}
			<div class="group border-border relative overflow-hidden rounded-lg border">
				<button
					class={cn(
						"relative size-14",
						"flex items-center justify-center",
						attachment.preview ? "" : "bg-muted",
					)}
					onclick={() => openViewer(attachment)}
				>
					{#if attachment.preview}
						<img
							src={attachment.preview}
							alt={attachment.name}
							class="h-full w-full object-cover"
						/>
					{:else}
						{@const IconComponent = getFileIcon(attachment)}
						<div
							class="text-muted-foreground flex h-full w-full flex-col items-center justify-center gap-y-1 px-0.5"
						>
							<IconComponent class="size-6" />
							<span class="max-w-full truncate text-xs leading-none">
								{attachment.name}
							</span>
						</div>
					{/if}
				</button>

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

				<button
					onclick={() => handleRemove(attachment.id)}
					class="text-destructive pointer-events-auto absolute top-0.5 right-0 size-4 opacity-0 group-hover:opacity-100"
				>
					<Trash2 class="hover:text-destructive/80 size-3.5" />
				</button>
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
