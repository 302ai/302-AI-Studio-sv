<script lang="ts" module>
	export interface SelectOption {
		label: string;
		value: string;
		key?: string;
	}

	interface Props {
		name: string;
		value: string;
		options: SelectOption[];
		placeholder?: string;
		class?: string;
		onValueChange?: (value: string) => void;
	}
</script>

<script lang="ts">
	import * as Empty from "$lib/components/ui/empty/index.js";

	import * as Select from "$lib/components/ui/select/index.js";
	import { m } from "$lib/paraglide/messages";
	import { cn } from "$lib/utils";

	let {
		name,
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

<Select.Root type="single" {name} bind:value {onValueChange}>
	<Select.Trigger
		class={cn(
			"!bg-settings-item-bg dark:!bg-settings-item-bg data-[size=default]:h-settings-item w-full",
			className,
		)}
	>
		{placeholder && !value ? placeholder : getLabel(value)}
	</Select.Trigger>
	<Select.Content>
		{#if options.length === 0}
			<Empty.Root>
				<Empty.Content>
					<Empty.Description>
						{m.select_no_options()}
					</Empty.Description>
				</Empty.Content>
			</Empty.Root>
		{:else}
			{#each options as option (option.key || option.value)}
				<Select.Item value={option.value} label={option.label} />
			{/each}
		{/if}
	</Select.Content>
</Select.Root>
