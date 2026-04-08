<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import AspectRatio from "$lib/components/ui/aspect-ratio/aspect-ratio.svelte";
	import type { AspectRatio as AspectRatioPrimitive } from "bits-ui";

	type OpenUIAspectRatioProps = Pick<AspectRatioPrimitive.RootProps, "ratio"> & {
		children?: unknown;
	};

	let { props, renderNode }: ComponentRenderProps<OpenUIAspectRatioProps> = $props();
</script>

<AspectRatio ratio={props.ratio}>
	{#if props.children}
		{@render renderNode(props.children)}
	{/if}
</AspectRatio>
