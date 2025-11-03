<script lang="ts" module>
	import type { AttachmentFile } from "@shared/types";

	export interface ViewerPanelProps {
		attachment: AttachmentFile;
		isOpen: boolean;
		onClose: () => void;
	}
</script>

<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog";
	import {
		AudioViewer,
		CodeViewer,
		DocumentViewer,
		ImageViewer,
		TextViewer,
		UnknownViewer,
		VideoViewer,
	} from "./index";
	import { formatFileSize, getViewerType } from "./viewer-utils";

	const { attachment, isOpen, onClose }: ViewerPanelProps = $props();

	const viewerType = $derived(getViewerType(attachment));
</script>

<Dialog.Root open={isOpen} onOpenChange={onClose}>
	<Dialog.Content class="w-fit max-w-[95vw] min-w-[60vw] gap-0 rounded-[10px] p-0">
		<div
			class="bg-chat-attachment-viewer flex items-center gap-2 rounded-t-[10px] border-b p-4 text-sm"
		>
			<span class="truncate" title={attachment.name}>
				{attachment.name}
			</span>
			<span class="text-muted-foreground">
				{formatFileSize(attachment.size)}
			</span>
		</div>

		<div
			class="flex flex-1 items-center justify-center overflow-hidden"
			style="height: 70vh; width: 70vw; position: relative;"
		>
			{#if viewerType === "image" && attachment.preview}
				<ImageViewer src={attachment.preview} alt={attachment.name} />
			{:else if viewerType === "audio"}
				<AudioViewer src={attachment.preview} />
			{:else if viewerType === "video"}
				<VideoViewer src={URL.createObjectURL(attachment.file)} />
			{:else if viewerType === "code"}
				<CodeViewer {attachment} fileName={attachment.name} />
			{:else if viewerType === "document"}
				<DocumentViewer {attachment} />
			{:else if viewerType === "text"}
				<TextViewer {attachment} />
			{:else}
				<UnknownViewer />
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>
