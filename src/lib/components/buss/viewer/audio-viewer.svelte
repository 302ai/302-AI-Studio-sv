<script lang="ts" module>
	export interface AudioViewerProps {
		src?: string;
	}
</script>

<script lang="ts">
	import { Headphones } from "@lucide/svelte";
	import ErrorState from "./error-state.svelte";
	import ViewerBase from "./viewer-base.svelte";

	let { src }: AudioViewerProps = $props();
</script>

<ViewerBase>
	<div class="flex h-full items-center justify-center p-6">
		{#if src}
			<div class="flex w-full max-w-md flex-col items-center gap-y-8">
				<div class="rounded-full bg-muted p-4">
					<Headphones class="h-10 w-10 " />
				</div>

				<audio {src} class="w-full" controls preload="metadata"> </audio>
			</div>
		{:else}
			<ErrorState />
		{/if}
	</div>
</ViewerBase>
