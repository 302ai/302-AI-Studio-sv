<script lang="ts" module>
	import type { AttachmentFile } from "$lib/stores/chat-state.svelte";

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
	import { Button } from "$lib/components/ui/button";
	import { FolderOpen } from "@lucide/svelte";

	const { attachmentsService } = window.service;

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

			<Button
				variant="ghost"
				size="icon"
				onclick={() => {
					console.log("attachmentsService", attachmentsService);
					attachmentsService.openExternal("https://302.ai");
				}}
				>1
				<FolderOpen />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onclick={() => {
					console.log("attachmentsService", attachmentsService);
					attachmentsService.openExternal2("https://302.ai");
				}}
				>2
				<FolderOpen />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				onclick={() => {
					console.log("attachmentsService", attachmentsService);
					attachmentsService.openExternal3("https://302.ai");
				}}
				>3
				<FolderOpen />
			</Button>
		</div>

		<div class="flex flex-1 items-center justify-center overflow-hidden">
			<div style="height: 70vh; width: 70vw; position: relative;">
				{#if viewerType === "image" && attachment.preview}
					<ImageViewer src={attachment.preview} alt={attachment.name} />
				{:else if viewerType === "audio"}
					<AudioViewer src={attachment.preview} />
				{:else if viewerType === "video"}
					<VideoViewer src={URL.createObjectURL(attachment.file)} />
				{:else if viewerType === "code"}
					<CodeViewer {attachment} fileName={attachment.name} />
				{:else if viewerType === "document"}
					<DocumentViewer src={attachment.preview} fileName={attachment.name} />
				{:else if viewerType === "text"}
					<TextViewer {attachment} />
				{:else}
					<UnknownViewer />
				{/if}
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
