<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle,
	} from "$lib/components/ui/card";

	type OpenUICardProps = {
		class?: string;
		title?: string;
		description?: string;
		children?: unknown;
		footer?: string;
	};

	let { props, renderNode }: ComponentRenderProps<OpenUICardProps> = $props();
</script>

<Card class={props.class}>
	{#if props.title || props.description}
		<CardHeader>
			{#if props.title}
				<CardTitle>{props.title}</CardTitle>
			{/if}
			{#if props.description}
				<CardDescription>{props.description}</CardDescription>
			{/if}
		</CardHeader>
	{/if}

	<CardContent>
		{#if props.children}
			{@render renderNode(props.children)}
		{/if}
	</CardContent>

	{#if props.footer}
		<CardFooter>{props.footer}</CardFooter>
	{/if}
</Card>
