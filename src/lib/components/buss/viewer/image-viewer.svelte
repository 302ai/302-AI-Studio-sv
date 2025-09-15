<script lang="ts" module>
	export interface ImageViewerProps {
		src: string;
		alt: string;
	}
</script>

<script lang="ts">
	import { ImageViewer } from "svelte-image-viewer";
	import ViewerBase from "./viewer-base.svelte";

	let { src, alt }: ImageViewerProps = $props();
</script>

<ViewerBase>
	<ImageViewer
		{src}
		{alt}
		targetOffsetX={0}
		targetOffsetY={0}
		targetScale={0.5}
		minScale={0.1}
		maxScale={5}
	/>
</ViewerBase>
