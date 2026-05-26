<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import { cn } from "$lib/utils";

	type OpenUIChatPanelProps = {
		title?: string;
		description?: string;
		class?: string;
		children?: unknown;
	};

	let { props, renderNode }: ComponentRenderProps<OpenUIChatPanelProps> = $props();
</script>

<div
	class={cn(
		"bg-input overflow-hidden rounded-chat border text-foreground shadow-sm",
		props.class,
	)}
>
	{#if props.title || props.description}
		<div class="border-b px-4 py-3 sm:px-5">
			{#if props.title}
				<h2 class="text-sm font-medium">{props.title}</h2>
			{/if}
			{#if props.description}
				<p class="text-muted-foreground mt-1 text-sm">{props.description}</p>
			{/if}
		</div>
	{/if}

	<div class="flex min-h-0 flex-col p-4 sm:p-5">
		{#if props.children}
			{@render renderNode(props.children)}
		{/if}
	</div>
</div>
