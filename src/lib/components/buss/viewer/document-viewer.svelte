<script lang="ts" module>
	export interface DocumentViewerProps {
		src?: string;
		fileName?: string;
	}
</script>

<script lang="ts">
	import ViewerBase from "./viewer-base.svelte";

	let { fileName }: DocumentViewerProps = $props();
</script>

<ViewerBase>
	<div class="flex h-full items-center justify-center p-6">
		<div class="text-center">
			<p class="text-lg font-medium">Document Viewer</p>
			<p class="mt-2 text-sm text-muted-foreground">Document viewer will be implemented here</p>
			{#if fileName}
				<p class="mt-2 text-xs text-muted-foreground">File: {fileName}</p>
			{/if}
		</div>
	</div>
</ViewerBase>
