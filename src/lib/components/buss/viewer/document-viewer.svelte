<script lang="ts" module>
	export interface DocumentViewerProps {
		src?: string;
		fileName?: string;
	}
</script>

<script lang="ts">
	import ViewerBase from "./viewer-base.svelte";

	const { fileName }: DocumentViewerProps = $props();
</script>

<ViewerBase>
	<div class="flex h-full items-center justify-center p-6">
		<div class="text-center">
			<p class="text-lg font-medium">Document Viewer</p>
			<p class="text-muted-foreground mt-2 text-sm">Document viewer will be implemented here</p>
			{#if fileName}
				<p class="text-muted-foreground mt-2 text-xs">File: {fileName}</p>
			{/if}
		</div>
	</div>
</ViewerBase>
