<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Button from "$lib/components/ui/button/button.svelte";

	type OpenUIButtonProps = {
		class?: string;
		variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
		size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";
		ref?: HTMLElement;
		href?: string;
		type?: "button" | "submit" | "reset";
		disabled?: boolean;
		children?: unknown;
	};

	let { props, renderNode }: ComponentRenderProps<OpenUIButtonProps> = $props();
</script>

<Button
	class={props.class}
	variant={props.variant}
	size={props.size}
	ref={props.ref}
	href={props.href}
	type={props.type}
	disabled={props.disabled}
>
	{#if props.children}
		{@render renderNode(props.children)}
	{/if}
</Button>
