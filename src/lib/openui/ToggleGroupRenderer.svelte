<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import { ToggleGroup, ToggleGroupItem } from "$lib/components/ui/toggle-group";

	type OpenUIToggleGroupItem = {
		value: string;
		label: string;
		disabled?: boolean;
	};

	type OpenUIToggleGroupProps = {
		class?: string;
		type?: "single" | "multiple";
		value?: string | string[];
		variant?: "default" | "outline";
		size?: "default" | "sm" | "lg";
		items?: OpenUIToggleGroupItem[];
	};

	let { props }: ComponentRenderProps<OpenUIToggleGroupProps> = $props();
</script>

{#if (props.type ?? "single") === "multiple"}
	<ToggleGroup
		class={props.class}
		type="multiple"
		value={Array.isArray(props.value) ? props.value : []}
		variant={props.variant}
		size={props.size}
	>
		{#each props.items ?? [] as item (item.value)}
			<ToggleGroupItem value={item.value} disabled={item.disabled}
				>{item.label}</ToggleGroupItem
			>
		{/each}
	</ToggleGroup>
{:else}
	<ToggleGroup
		class={props.class}
		type="single"
		value={typeof props.value === "string" ? props.value : undefined}
		variant={props.variant}
		size={props.size}
	>
		{#each props.items ?? [] as item (item.value)}
			<ToggleGroupItem value={item.value} disabled={item.disabled}
				>{item.label}</ToggleGroupItem
			>
		{/each}
	</ToggleGroup>
{/if}
