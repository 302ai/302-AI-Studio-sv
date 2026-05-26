<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Label from "$lib/components/ui/label/label.svelte";
	import type { Label as LabelPrimitive } from "bits-ui";

	type OpenUILabelProps = Pick<LabelPrimitive.RootProps, "for"> & {
		class?: string;
		children?: unknown;
	};

	let { props, renderNode }: ComponentRenderProps<OpenUILabelProps> = $props();
</script>

<Label class={props.class} for={props.for}>
	{#if props.children}
		{@render renderNode(props.children)}
	{/if}
</Label>
