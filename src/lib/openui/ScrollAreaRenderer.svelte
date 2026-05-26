<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";

	type OpenUIScrollAreaProps = {
		class?: string;
		orientation?: "vertical" | "horizontal" | "both";
		children?: unknown;
	};

	let { props, renderNode }: ComponentRenderProps<OpenUIScrollAreaProps> = $props();
</script>

<ScrollArea class={props.class} orientation={props.orientation}>
	{#if props.children}
		{@render renderNode(props.children)}
	{/if}
</ScrollArea>
