<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import { cn } from "$lib/utils";

	type OpenUITextProps = {
		value?: string;
		class?: string;
		variant?: "default" | "muted" | "title";
	};

	let { props }: ComponentRenderProps<OpenUITextProps> = $props();
</script>

{#if props.variant === "title"}
	<h3 class={cn("text-base font-medium leading-relaxed", props.class)}>{props.value}</h3>
{:else}
	<p
		class={cn(
			"whitespace-pre-wrap break-words text-sm leading-relaxed",
			props.variant === "muted" && "text-muted-foreground",
			props.class,
		)}
	>
		{props.value}
	</p>
{/if}
