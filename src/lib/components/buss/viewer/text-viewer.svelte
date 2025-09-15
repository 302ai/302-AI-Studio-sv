<script lang="ts" module>
	import type { AttachmentFile } from "$lib/stores/chat-state.svelte";

	export interface TextViewerProps {
		attachment: AttachmentFile;
	}
</script>

<script lang="ts">
	import * as ScrollArea from "$lib/components/ui/scroll-area";
	import ErrorState from "./error-state.svelte";
	import ViewerBase from "./viewer-base.svelte";
	import { loadTextContent } from "./viewer-utils";

	const { attachment }: TextViewerProps = $props();

	let content = $state<string | null>(null);

	async function loadContent() {
		try {
			content = await loadTextContent(attachment);
		} catch (error) {
			console.error("Failed to load text content:", error);
			content = null;
		}
	}
	$effect(() => {
		loadContent();
	});
</script>

<ViewerBase>
	{#if content}
		<ScrollArea.Root class="h-full w-full">
			<ScrollArea.Scrollbar
				orientation="vertical"
				class="flex touch-none p-0.5 transition-colors duration-100 select-none"
			></ScrollArea.Scrollbar>

			<pre
				class="text-foreground cursor-text px-4 py-2 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap select-text">{content}</pre>
		</ScrollArea.Root>
	{:else}
		<ErrorState />
	{/if}
</ViewerBase>
