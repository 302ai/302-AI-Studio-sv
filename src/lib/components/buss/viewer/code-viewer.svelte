<script lang="ts" module>
	import type { AttachmentFile } from "$lib/stores/chat-state.svelte";

	export interface CodeViewerProps {
		attachment: AttachmentFile;
		fileName?: string;
	}
</script>

<script lang="ts">
	import * as ScrollArea from "$lib/components/ui/scroll-area";
	import ViewerBase from "./viewer-base.svelte";
	import { loadTextContent } from "./viewer-utils";

	let { attachment, fileName }: CodeViewerProps = $props();

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
				<div class="mb-4 border-b pb-2 text-sm font-medium text-muted-foreground">
					{fileName}
				</div>
			{/if}
			<pre
				class="cursor-text font-mono text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground select-text">{content}</pre>
		</div>
	</ScrollArea.Root>
</ViewerBase>
