<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Toggle from "$lib/components/ui/toggle/toggle.svelte";

	type OpenUIToggleProps = {
		class?: string;
		pressed?: boolean;
		disabled?: boolean;
		variant?: "default" | "outline";
		size?: "default" | "sm" | "lg";
		children?: unknown;
	};

	let { props, renderNode }: ComponentRenderProps<OpenUIToggleProps> = $props();
</script>

<Toggle
	class={props.class}
	pressed={props.pressed}
	disabled={props.disabled}
	variant={props.variant}
	size={props.size}
>
	{#if props.children}
		{@render renderNode(props.children)}
	{/if}
</Toggle>
