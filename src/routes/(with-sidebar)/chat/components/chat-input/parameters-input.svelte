<script lang="ts" module>
	interface Props {
		label: string;
		tips?: string;
		value: number | null;
		onChange: (value: number | null) => void;
	}
</script>

<script lang="ts">
	import { LabelWithTips } from "$lib/components/buss/label-with-tips";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";

	let { label, tips, value, onChange }: Props = $props();

	let errorMessage: string | null = $state(null);
	let inputValue = $derived(value ? value.toString() : "");

	const validateInteger = (inputValue: string): boolean => {
		if (inputValue === "") return true;

		const num = Number(inputValue);
		return Number.isInteger(num) && num >= 1;
	};

	const handleValueChange = (event: Event) => {
		const target = event.target as HTMLInputElement;
		const newValue = target.value;

		if (newValue.trim() === "") {
			errorMessage = null;
			onChange(null);
			return;
		}

		if (!validateInteger(newValue)) {
			errorMessage = m.text_invalid_input_integer();
			return;
		}

		errorMessage = null;
		onChange(Number(newValue));
	};
</script>

<div class="flex flex-col gap-y-2">
	<div class="flex flex-1 flex-row justify-between">
		{#if tips === undefined}
			<Label class="text-label-fg">{label}</Label>
		{:else}
			<LabelWithTips class="z-51" {label} {tips} tooltipPlacement="right" />
		{/if}
		<Input
			class="h-7 w-20 border-border"
			aria-invalid={!!errorMessage}
			value={inputValue}
			placeholder={m.placeholder_input()}
			oninput={handleValueChange}
		/>
	</div>

	{#if errorMessage}
		<div class="self-end text-xs text-destructive">{errorMessage}</div>
	{/if}
</div>
