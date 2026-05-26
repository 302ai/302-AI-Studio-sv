<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Badge from "$lib/components/ui/badge/badge.svelte";

	type OpenUIBadgeProps = {
		class?: string;
		variant?: "default" | "secondary" | "destructive" | "outline";
		href?: string;
		text?: string;
		children?: unknown;
	};

	let { props, renderNode }: ComponentRenderProps<OpenUIBadgeProps> = $props();
</script>

<Badge class={props.class} variant={props.variant} href={props.href}>
	{#if props.children}
		{@render renderNode(props.children)}
	{:else}
		{props.text ?? ""}
	{/if}
</Badge>
