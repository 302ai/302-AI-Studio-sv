<script lang="ts" module>
	import type { AttachmentFile } from "@shared/types";

	export interface CodeViewerProps {
		attachment: AttachmentFile;
		fileName?: string;
	}
</script>

<script lang="ts">
	import * as ScrollArea from "$lib/components/ui/scroll-area";
	import ViewerBase from "./viewer-base.svelte";
	import { loadTextContent } from "./viewer-utils";

	const { attachment, fileName }: CodeViewerProps = $props();

	let content = $state<string>("");

	async function loadContent() {
		try {
			content = await loadTextContent(attachment);
		} catch (error) {
			console.error("Failed to load code content:", error);
			content = "Error loading code content";
		}
	}
	$effect(() => {
		loadContent();
	});
</script>

<ViewerBase class="bg-background">
	<ScrollArea.Root class="h-full w-full">
		<ScrollArea.Scrollbar
			orientation="vertical"
			class="flex touch-none p-0.5 transition-colors duration-100 select-none"
		></ScrollArea.Scrollbar>

		<div class="p-4">
			{#if fileName}
				<div class="text-muted-foreground mb-4 border-b pb-2 text-sm font-medium">
					{fileName}
				</div>
			{/if}
			<pre
				class="text-foreground cursor-text font-mono text-sm leading-relaxed break-words whitespace-pre-wrap select-text">{content}</pre>
		</div>
	</ScrollArea.Root>
</ViewerBase>
