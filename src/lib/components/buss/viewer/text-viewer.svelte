<script lang="ts" module>
	import type { AttachmentFile } from "@shared/types";

	export interface TextViewerProps {
		attachment: AttachmentFile;
	}
</script>

<script lang="ts">
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
		<pre
			class="text-foreground cursor-text pl-4 pr-2 py-2 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap select-text overflow-auto h-full mr-1">{content}</pre>
	{:else}
		<ErrorState />
	{/if}
</ViewerBase>
