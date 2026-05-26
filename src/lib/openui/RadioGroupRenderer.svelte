<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import { Label } from "$lib/components/ui/label";

	type OpenUIRadioOption = {
		value: string;
		label: string;
		description?: string;
		disabled?: boolean;
	};

	type OpenUIRadioGroupProps = {
		class?: string;
		value?: string;
		name?: string;
		disabled?: boolean;
		orientation?: "vertical" | "horizontal";
		options?: OpenUIRadioOption[];
	};

	let { props }: ComponentRenderProps<OpenUIRadioGroupProps> = $props();
</script>

<RadioGroup
	class={props.class}
	value={props.value}
	name={props.name}
	disabled={props.disabled}
	orientation={props.orientation}
>
	{#each props.options ?? [] as option, index (option.value)}
		<div class="flex items-start gap-3">
			<RadioGroupItem
				value={option.value}
				id={`${props.name ?? "radio-group"}-${index}`}
				disabled={option.disabled}
			/>
			<div class="grid gap-1.5">
				<Label for={`${props.name ?? "radio-group"}-${index}`}>{option.label}</Label>
				{#if option.description}
					<p class="text-muted-foreground text-sm">{option.description}</p>
				{/if}
			</div>
		</div>
	{/each}
</RadioGroup>
