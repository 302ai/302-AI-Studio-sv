<script lang="ts">
	import {
		getFileIcon,
		shouldShowPreviewAsThumbnail,
	} from "$lib/components/buss/viewer/viewer-utils.js";
	import type { AttachmentFile } from "@shared/types";

	import { cn } from "$lib/utils";
	interface Props {
		attachment: AttachmentFile;
		openViewer: (attachment: AttachmentFile) => void;
	}

	let { attachment, openViewer }: Props = $props();
</script>

<button
	class={cn(
		"relative size-14",
		"flex items-center justify-center",
		attachment.preview && shouldShowPreviewAsThumbnail(attachment) ? "" : "bg-muted",
	)}
	onclick={() => openViewer(attachment)}
>
	{#if attachment.preview && shouldShowPreviewAsThumbnail(attachment)}
		<img src={attachment.preview} alt={attachment.name} class="h-full w-full object-cover" />
	{:else}
		{@const IconComponent = getFileIcon(attachment)}
		<div
			class="flex h-full w-full flex-col items-center justify-center gap-y-1 px-0.5 text-muted-foreground"
		>
			<IconComponent class="size-6" />
			<span class="max-w-full truncate text-xs leading-none">
				{attachment.name}
			</span>
		</div>
	{/if}
</button>
