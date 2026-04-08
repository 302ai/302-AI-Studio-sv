<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import { cn } from "$lib/utils";

	type OpenUIStackProps = {
		children?: unknown;
		direction?: "vertical" | "horizontal";
		gap?: "s" | "m" | "l";
		class?: string;
	};

	const gapClassMap = {
		s: "gap-2",
		m: "gap-3",
		l: "gap-4",
	} as const;

	let { props, renderNode }: ComponentRenderProps<OpenUIStackProps> = $props();
</script>

<div
	class={cn(
		"flex min-h-0",
		props.direction === "horizontal" ? "flex-row items-center" : "flex-col",
		gapClassMap[props.gap ?? "m"],
		props.class,
	)}
>
	{#if props.children}
		{@render renderNode(props.children)}
	{/if}
</div>
