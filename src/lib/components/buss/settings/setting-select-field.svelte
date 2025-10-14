<script lang="ts">
	import Label from "$lib/components/ui/label/label.svelte";
	import SettingSelect, { type SelectOption } from "./setting-select.svelte";

	interface Props {
		label: string;
		name: string;
		value?: string;
		options: SelectOption[];
		placeholder?: string;
		class?: string;
		required?: boolean;
	}

	let {
		label,
		name,
		value = $bindable(""),
		options,
		placeholder,
		class: className,
		required = false,
	}: Props = $props();
</script>

<div class="flex flex-col gap-2 {className || ''}">
	<Label>
		{label}
		{#if required}
			<span class="ml-1 text-red-500">*</span>
		{/if}
	</Label>
	<SettingSelect {name} bind:value {options} {placeholder} />
</div>
