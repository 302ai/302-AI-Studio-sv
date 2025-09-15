<script lang="ts" module>
	export interface VideoViewerProps {
		src?: string;
	}
</script>

<script lang="ts">
	import ErrorState from "./error-state.svelte";
	import ViewerBase from "./viewer-base.svelte";

	let { src }: VideoViewerProps = $props();
</script>

<ViewerBase>
	{#if src}
		<video {src} controls preload="metadata" style="width: 100%; height: 100%; object-fit: contain">
			<track kind="captions" />
		</video>
	{:else}
		<ErrorState />
	{/if}
</ViewerBase>
