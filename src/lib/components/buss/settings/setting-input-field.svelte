<script lang="ts">
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { cn } from "$lib/utils";

	interface Props {
		label: string;
		required?: boolean;
		id?: string;
		type?: string;
		placeholder?: string;
		value?: string | number;
		class?: string;
		inputClass?: string;
		disabled?: boolean;
	}

	let {
		label,
		required = false,
		id,
		type,
		placeholder,
		value = $bindable(""),
		class: className,
		inputClass,
		disabled,
	}: Props = $props();
</script>

<div class="flex flex-col gap-2 {className || ''}">
	<Label for={id}>
		{label}
		{#if required}
			<span class="ml-1 text-red-500">*</span>
		{/if}
	</Label>
	<Input
		{id}
		{type}
		{placeholder}
		{disabled}
		bind:value
		class={cn(
			"!bg-settings-item-bg dark:!bg-settings-item-bg rounded-settings-item hover:ring-ring hover:ring-1",
			inputClass,
		)}
	/>
</div>
