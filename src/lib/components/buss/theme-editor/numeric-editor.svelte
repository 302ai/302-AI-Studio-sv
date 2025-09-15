<script lang="ts" module>
	interface Props {
		label: string;
		value: string;
		description?: string;
		min?: number;
		max?: number;
		step?: number;
		unit?: string;
		presets?: string[];
		onValueChange?: (value: string) => void;
	}
</script>

<script lang="ts">
	import { Slider } from "$lib/components/ui/slider";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Button } from "$lib/components/ui/button";
	import { Badge } from "$lib/components/ui/badge";
	import { cn } from "$lib/utils";
	import { m } from "$lib/paraglide/messages.js";

	let {
		label,
		value = $bindable(""),
		description,
		min = 0,
		max = 100,
		step = 1,
		unit = "",
		presets = [],
		onValueChange,
	}: Props = $props();
	function parseValue(val: string): number {
		const numMatch = val.match(/^([0-9.]+)/);
		return numMatch ? parseFloat(numMatch[1]) : 0;
	}
	function formatValue(num: number): string {
		const formattedNum = step < 1 ? num.toFixed(2).replace(/\.?0+$/, "") : num.toString();
		return unit ? `${formattedNum}${unit}` : formattedNum;
	}

	let numericValue = $state(parseValue(value));
	let inputValue = $state(value);
	let isInitializing = $state(true);
	$effect(() => {
		numericValue = parseValue(value);
		inputValue = value;
	});
	$effect(() => {
		if (isInitializing) {
			setTimeout(() => {
				isInitializing = false;
			}, 0);
		}
	});

	function handleSliderChange(newValue: number) {
		if (isInitializing) return;

		numericValue = newValue;
		const formatted = formatValue(newValue);
		inputValue = formatted;
		value = formatted;
		onValueChange?.(formatted);
	}

	function handleInputChange() {
		const parsed = parseValue(inputValue);
		if (!isNaN(parsed) && parsed >= min && parsed <= max) {
			numericValue = parsed;
			value = inputValue;
			onValueChange?.(inputValue);
		} else {
			inputValue = value;
		}
	}

	function selectPreset(preset: string) {
		inputValue = preset;
		value = preset;
		numericValue = parseValue(preset);
		onValueChange?.(preset);
	}

	function resetToDefault() {
		const defaultVal = formatValue(min);
		inputValue = defaultVal;
		value = defaultVal;
		numericValue = min;
		onValueChange?.(defaultVal);
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<Label class="text-sm font-medium">{label}</Label>
			{#if description}
				<p class="mt-1 text-xs text-muted-foreground">{description}</p>
			{/if}
		</div>
		<Button variant="ghost" size="sm" onclick={resetToDefault}>
			{m.text_button_theme_numeric_reset()}
		</Button>
	</div>

	<!-- Slider -->
	<div class="space-y-3">
		<Slider
			type="single"
			value={numericValue}
			onValueChange={handleSliderChange}
			{min}
			{max}
			{step}
			class="w-full"
		/>

		<!-- Value display and input -->
		<div class="flex items-center gap-3">
			<div class="flex-1">
				<Input
					bind:value={inputValue}
					onblur={handleInputChange}
					onkeydown={(e) => e.key === "Enter" && handleInputChange()}
					class="font-mono text-sm"
					placeholder={m.text_theme_variable_range({
						min: `${min}${unit}`,
						max: `${max}${unit}`,
					})}
				/>
			</div>
			<div class="min-w-0 text-sm text-muted-foreground">
				<span class="font-mono">{formatValue(numericValue)}</span>
			</div>
		</div>
	</div>

	<!-- Presets -->
	{#if presets.length > 0}
		<div class="space-y-2">
			<Label class="text-xs text-muted-foreground">{m.text_label_theme_numeric_presets()}</Label>
			<div class="flex flex-wrap gap-1.5">
				{#each presets as preset (preset)}
					<Badge
						variant={value === preset ? "default" : "outline"}
						class={cn(
							"cursor-pointer px-2 py-1 text-xs hover:bg-accent",
							value === preset && "bg-primary text-primary-foreground",
						)}
						onclick={() => selectPreset(preset)}
					>
						{preset}
					</Badge>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Range display -->
	<div class="flex justify-between text-xs text-muted-foreground">
		<span>{formatValue(min)}</span>
		<span>{formatValue(max)}</span>
	</div>
</div>
