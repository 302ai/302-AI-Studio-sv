<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Alert from "$lib/components/ui/alert/alert.svelte";

	type OpenUIAlertProps = {
		class?: string;
		variant?: "default" | "destructive";
		children?: unknown;
	};

	let { props, renderNode }: ComponentRenderProps<OpenUIAlertProps> = $props();
</script>

<Alert class={props.class} variant={props.variant}>
	{#if props.children}
		{@render renderNode(props.children)}
	{/if}
</Alert>
