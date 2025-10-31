<script lang="ts" module>
	import type { AttachmentFile } from "@shared/types";

	export interface DocumentViewerProps {
		attachment: AttachmentFile;
	}
</script>

<script lang="ts">
	import { onMount } from "svelte";
	import ErrorState from "./error-state.svelte";
	import ViewerBase from "./viewer-base.svelte";

	const { attachment }: DocumentViewerProps = $props();

	let pdfUrl = $state<string | null>(null);
	let hasError = $state(false);
	let needsCleanup = $state(false);

	onMount(() => {
		try {
			// Use preview data URL if available (for saved messages)
			if (attachment.preview) {
				pdfUrl = attachment.preview;
				needsCleanup = false;
			}
			// Otherwise create object URL from the file (for new attachments)
			else if (attachment.file && attachment.file.size > 0) {
				pdfUrl = URL.createObjectURL(attachment.file);
				needsCleanup = true;
			} else {
				hasError = true;
			}

			// Cleanup on unmount (only if we created an object URL)
			return () => {
				if (pdfUrl && needsCleanup) {
					URL.revokeObjectURL(pdfUrl);
				}
			};
		} catch (error) {
			console.error("Failed to create PDF preview:", error);
			hasError = true;
		}
	});
</script>

<ViewerBase>
	{#if hasError}
		<ErrorState />
	{:else if pdfUrl}
		<iframe
			src={pdfUrl}
			title={attachment.name}
			class="h-full w-full border-0"
			style="background: white;"
		/>
	{:else}
		<div class="flex h-full items-center justify-center">
			<p class="text-muted-foreground">加载中...</p>
		</div>
	{/if}
</ViewerBase>
