<script lang="ts" module>
	export interface SelectOption {
		label: string;
		value: string;
		key?: string;
	}

	interface Props {
		label: string;
		description?: string;
		value?: string;
		options: SelectOption[];
		placeholder?: string;
		class?: string;
		onValueChange?: (value: string) => void;
	}
</script>

<script lang="ts">
	import * as Select from "$lib/components/ui/select/index.js";
	import { cn } from "$lib/utils";

	let {
		label,
		description,
		value = $bindable(),
		options,
		placeholder,
		class: className,
		onValueChange,
	}: Props = $props();

	function getLabel(val: string) {
		return options.find((option) => option.value === val)?.label || val;
	}
</script>

<div
	class={cn(
		"rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y flex w-full items-center justify-between",
		className,
	)}
>
	<div class="flex flex-col gap-1 flex-1">
		<span class="text-sm">{label}</span>
		{#if description}
			<p class="text-muted-foreground text-xs">{description}</p>
		{/if}
	</div>
	<Select.Root type="single" name={label} bind:value {onValueChange}>
		<Select.Trigger
			class="!bg-settings-bg dark:!bg-settings-bg data-[size=default]:h-9 min-w-[120px]"
		>
			{placeholder && !value ? placeholder : getLabel(value ?? "")}
		</Select.Trigger>
		<Select.Content>
			{#each options as option (option.key || option.value)}
				<Select.Item value={option.value} label={option.label} />
			{/each}
		</Select.Content>
	</Select.Root>
</div>
