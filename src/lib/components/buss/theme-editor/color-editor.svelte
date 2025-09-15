<script lang="ts" module>
	interface Props {
		label: string;
		value: string;
		description?: string;
		onValueChange?: (value: string) => void;
	}
</script>

<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Button } from "$lib/components/ui/button";
	import { cn } from "$lib/utils";
	import { m } from "$lib/paraglide/messages.js";

	let { label, value = $bindable(""), description, onValueChange }: Props = $props();
	const colorPresets = [
		"#000000",
		"#ffffff",
		"#f3f4f6",
		"#6b7280",
		"#374151",
		"#ef4444",
		"#f97316",
		"#eab308",
		"#22c55e",
		"#3b82f6",
		"#8b5cf6",
		"#ec4899",
		"#14b8a6",
		"#f59e0b",
		"#84cc16",
	];

	let colorInputValue = $state(convertToHex(value));
	let textInputValue = $state(value);
	let isInitializing = $state(true);
	$effect(() => {
		if (isInitializing) {
			setTimeout(() => {
				isInitializing = false;
			}, 0);
		}
	});
	function convertToHex(colorValue: string): string {
		const testElement = document.createElement("div");
		testElement.style.color = colorValue;
		document.body.appendChild(testElement);
		const computed = window.getComputedStyle(testElement).color;
		document.body.removeChild(testElement);

		const match = computed.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		if (match) {
			const r = parseInt(match[1]).toString(16).padStart(2, "0");
			const g = parseInt(match[2]).toString(16).padStart(2, "0");
			const b = parseInt(match[3]).toString(16).padStart(2, "0");
			return `#${r}${g}${b}`;
		}
		if (colorValue.match(/^#[0-9a-fA-F]{6}$/)) {
			return colorValue;
		}

		return "#000000";
	}

	function handleColorInputChange(newColor: string) {
		if (isInitializing) return;

		colorInputValue = newColor;
		textInputValue = newColor;
		value = newColor;
		onValueChange?.(newColor);
	}

	function handleTextInputChange() {
		if (isInitializing) return;

		value = textInputValue;
		onValueChange?.(textInputValue);
		if (textInputValue.match(/^#[0-9a-fA-F]{6}$/)) {
			colorInputValue = textInputValue;
		}
	}

	function selectPreset(presetColor: string) {
		if (isInitializing) return;

		colorInputValue = presetColor;
		textInputValue = presetColor;
		value = presetColor;
		onValueChange?.(presetColor);
	}

	function resetToDefault() {
		const defaultColor = "#000000";
		colorInputValue = defaultColor;
		textInputValue = defaultColor;
		value = defaultColor;
		onValueChange?.(defaultColor);
	}
</script>

<div class="space-y-3">
	<div class="flex items-center justify-between">
		<div>
			<Label class="text-sm font-medium">{label}</Label>
			{#if description}
				<p class="mt-1 text-xs text-muted-foreground">{description}</p>
			{/if}
		</div>
		<Button variant="ghost" size="sm" onclick={resetToDefault}>
			{m.text_button_theme_color_reset()}
		</Button>
	</div>

	<!-- Color picker and text input row -->
	<div class="flex items-center gap-3">
		<div class="relative">
			<input
				type="color"
				bind:value={colorInputValue}
				onchange={(e) => handleColorInputChange(e.currentTarget.value)}
				class="h-8 w-12 cursor-pointer rounded border border-input disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:rounded [&::-webkit-color-swatch-wrapper]:p-0"
			/>
		</div>

		<Input
			bind:value={textInputValue}
			onblur={handleTextInputChange}
			onkeydown={(e) => e.key === "Enter" && handleTextInputChange()}
			placeholder={m.placeholder_input_theme_color()}
			class="flex-1 font-mono text-sm"
		/>
	</div>

	<!-- Color presets -->
	<div class="space-y-2">
		<Label class="text-xs text-muted-foreground">{m.text_label_theme_color_quick_colors()}</Label>
		<div class="flex flex-wrap gap-1.5">
			{#each colorPresets as preset (preset)}
				<button
					onclick={() => selectPreset(preset)}
					class={cn(
						"h-6 w-6 rounded border border-border transition-transform hover:scale-110",
						value === preset && "ring-2 ring-primary ring-offset-1",
					)}
					style="background-color: {preset}"
					title={preset}
					aria-label="Select color {preset}"
				></button>
			{/each}
		</div>
	</div>

	<!-- Current value display -->
	<div class="flex items-center gap-2 text-xs text-muted-foreground">
		<span>{m.text_theme_color_current()}</span>
		<div class="h-4 w-4 rounded border border-border" style="background-color: {value}"></div>
		<span class="font-mono">{value}</span>
	</div>
</div>
