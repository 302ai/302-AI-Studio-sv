<script lang="ts" module>
	import type { AttachmentFile } from "@shared/types";

	export interface DocumentViewerProps {
		attachment: AttachmentFile;
	}
</script>

<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { FileDown } from "@lucide/svelte";
	import { onMount } from "svelte";
	import ErrorState from "./error-state.svelte";
	import ViewerBase from "./viewer-base.svelte";

	const { attachment }: DocumentViewerProps = $props();

	let documentUrl = $state<string | null>(null);
	let hasError = $state(false);
	let needsCleanup = $state(false);
	let isPdf = $state(false);
	let isOfficeDocument = $state(false);

	onMount(() => {
		try {
			// Check if it's a PDF file
			isPdf =
				attachment.type === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf");

			// Check if it's an Office document (Excel, Word, PowerPoint)
			const lowerName = attachment.name.toLowerCase();
			isOfficeDocument =
				lowerName.endsWith(".xlsx") ||
				lowerName.endsWith(".xls") ||
				lowerName.endsWith(".docx") ||
				lowerName.endsWith(".doc") ||
				lowerName.endsWith(".pptx") ||
				lowerName.endsWith(".ppt");

			// Use preview data URL if available (for saved messages)
			if (attachment.preview) {
				documentUrl = attachment.preview;
				needsCleanup = false;
			}
			// Otherwise create object URL from the file (for new attachments)
			else if (attachment.file && attachment.file.size > 0) {
				documentUrl = URL.createObjectURL(attachment.file);
				needsCleanup = true;
			} else {
				hasError = true;
			}

			// Cleanup on unmount (only if we created an object URL)
			return () => {
				if (documentUrl && needsCleanup) {
					URL.revokeObjectURL(documentUrl);
				}
			};
		} catch (error) {
			console.error("Failed to create document preview:", error);
			hasError = true;
		}
	});

	function handleDownload() {
		if (!documentUrl) return;

		const link = document.createElement("a");
		link.href = documentUrl;
		link.download = attachment.name;
		link.click();
	}
</script>

<ViewerBase>
	{#if hasError}
		<ErrorState />
	{:else if documentUrl}
		{#if isPdf}
			<!-- PDF files can be displayed in iframe -->
			<iframe
				src={documentUrl}
				title={attachment.name}
				class="h-full w-full border-0"
				style="background: white;"
			></iframe>
		{:else if isOfficeDocument}
			<!-- Office documents cannot be displayed directly, show download option -->
			<div class="flex h-full flex-col items-center justify-center gap-4 p-8">
				<div class="text-muted-foreground text-center">
					<p class="mb-2 text-lg font-medium">{m.document_viewer_cannot_preview()}</p>
					<p class="text-sm">{m.document_viewer_download_instruction()}</p>
				</div>
				<button
					onclick={handleDownload}
					class="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-md px-4 py-2 transition-colors"
				>
					<FileDown class="h-4 w-4" />
					<span>{m.document_viewer_download_button()}</span>
				</button>
				<div class="text-muted-foreground mt-4 text-xs">
					<p>{m.document_viewer_filename()}: {attachment.name}</p>
					<p>
						{m.document_viewer_filesize()}: {(attachment.size / 1024).toFixed(2)} KB
					</p>
				</div>
			</div>
		{:else}
			<!-- Other document types (try to display in iframe) -->
			<iframe
				src={documentUrl}
				title={attachment.name}
				class="h-full w-full border-0"
				style="background: white;"
			></iframe>
		{/if}
	{:else}
		<div class="flex h-full items-center justify-center">
			<p class="text-muted-foreground">{m.document_viewer_loading()}</p>
		</div>
	{/if}
</ViewerBase>
