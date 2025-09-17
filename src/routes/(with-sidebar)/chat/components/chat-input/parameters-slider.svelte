<script lang="ts" module>
	export interface ParametersSliderProps {
		label: string;
		tips?: string;
		min: number;
		max: number;
		value: number | null;
		step: number;
		onChange: (value: number | null) => void;
	}
</script>

<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { LabelWithTips } from "$lib/components/buss/label-with-tips";
	import { Slider } from "$lib/components/ui/slider";

	let { label, tips, min, max, value, step, onChange }: ParametersSliderProps = $props();

	/**
	 * Step-count mapping (piecewise UI percent scale)
	 *
	 * UI slider uses a 0–100 percent scale with a reserved OFF segment.
	 * - 0% represents Off
	 * - OFF_PERCENT% represents Min
	 * - The remaining (100 - OFF_PERCENT)% is evenly divided into `totalSteps`
	 *   to represent values from Min to Max.
	 *
	 * This guarantees a consistent visual distance from Off → Min, regardless of
	 * the numeric range or the step size.
	 */
	const isOff = $derived(value === null);
	const effectiveStep = $derived(step > 0 ? step : 1);
	const totalSteps = $derived(Math.max(0, Math.round((max - min) / effectiveStep)));
	const OFF_PERCENT = 10; // fixed visual distance (%) between Off (0%) and Min
	const STEP_PERCENT = $derived(totalSteps > 0 ? (100 - OFF_PERCENT) / totalSteps : 0);
	const decimalPlaces = $derived(getStepDecimalPlaces(effectiveStep));

	/**
	 * Get the number of decimal places in a step value
	 */
	function getStepDecimalPlaces(step: number): number {
		if (step >= 1) return 0;
		const str = step.toString();
		if (str.includes(".")) {
			return str.split(".")[1].length;
		}
		if (str.includes("e-")) {
			return parseInt(str.split("e-")[1], 10);
		}
		return 0;
	}

	/**
	 * Converts a business value to the UI slider percent in [0, 100].
	 *
	 * @param val - The business value in [min, max] or null to represent Off.
	 * @returns The slider percent: 0 for Off, otherwise OFF_PERCENT + stepIndex*STEP_PERCENT.
	 */
	function mapValueToSliderPercent(val: number | null): number {
		if (val === null) return 0;
		if (totalSteps <= 0) return OFF_PERCENT;
		const stepIndex = Math.round((val - min) / effectiveStep);
		const clampedIndex = Math.max(0, Math.min(totalSteps, stepIndex));
		return OFF_PERCENT + clampedIndex * STEP_PERCENT;
	}

	/**
	 * Converts a UI slider percent to the business value.
	 *
	 * @param percent - Slider position in [0, 100]. 0 � Off; >= OFF_PERCENT � Min..Max.
	 * @returns The mapped business value in [min, max], or null if Off.
	 */
	function mapSliderPercentToValue(percent: number): number | null {
		// Midpoint between Off(0) and Min(OFF_PERCENT) decides the snap
		const offThreshold = OFF_PERCENT / 2;
		if (percent <= offThreshold) return null;
		if (totalSteps <= 0) return min;

		const rawIndex = (percent - OFF_PERCENT) / STEP_PERCENT;
		const clampedIndex = Math.max(0, Math.min(totalSteps, Math.round(rawIndex)));

		// Compute value from index; snap to max at rightmost index
		if (clampedIndex === totalSteps) return Number(max.toFixed(decimalPlaces));
		const v = min + clampedIndex * effectiveStep;
		return Number(Math.max(min, Math.min(max, v)).toFixed(decimalPlaces));
	}

	/**
	 * Snap the UI percent to the nearest allowed anchor:
	 * - 0 (Off)
	 * - OFF_PERCENT + k*STEP_PERCENT for k in [0..totalSteps]
	 */
	function snapPercent(percent: number): number {
		if (Math.abs(percent - 0) <= Math.abs(percent - OFF_PERCENT)) return 0;

		if (STEP_PERCENT <= 0 || totalSteps <= 0) return OFF_PERCENT;
		const k = Math.round((percent - OFF_PERCENT) / STEP_PERCENT);
		const clamped = Math.max(0, Math.min(totalSteps, k));
		return OFF_PERCENT + clamped * STEP_PERCENT;
	}

	/**
	 * Dynamic label widths (Off + value range)
	 */
	const offSegmentWidth = $derived(`${OFF_PERCENT}%`);
	const valueRangeWidth = $derived(`${100 - OFF_PERCENT}%`);

	/**
	 * Internal slider percent writable derived for two-way binding
	 */
	let internalSliderPercent = $derived.by(() => {
		return {
			get current() {
				return mapValueToSliderPercent(value);
			},
			set current(percent: number) {
				const snapped = snapPercent(percent);
				const mapped = mapSliderPercentToValue(snapped);
				onChange(mapped);
			},
		};
	});

	/**
	 * Handle slider value change from UI
	 */
	function handleSliderChange(newValue: number | number[]): void {
		const percent = typeof newValue === "number" ? newValue : newValue[0];
		internalSliderPercent.current = percent;
	}
</script>

<div class="flex flex-col gap-y-2">
	<!-- Label and value display -->
	<div class="flex w-full items-center">
		{#if tips}
			<LabelWithTips class="z-51" {label} {tips} />
		{:else}
			<span class="text-label-fg">{label}</span>
		{/if}
		<span class="text-fg ml-auto text-sm tabular-nums">
			{isOff ? m.settings_off() : (value as number).toFixed(decimalPlaces)}
		</span>
	</div>

	<!-- Slider -->
	<Slider
		type="single"
		bind:value={internalSliderPercent.current}
		min={0}
		max={100}
		step={0.1}
		onValueChange={handleSliderChange}
	/>

	<div class="flex flex-1 flex-row text-xs text-muted-foreground">
		<span style="width: {offSegmentWidth}">{m.settings_off()}</span>
		<span class="flex flex-row justify-between" style="width: {valueRangeWidth}">
			<span>{min.toFixed(decimalPlaces)}</span>
			<span>{max.toFixed(decimalPlaces)}</span>
		</span>
	</div>
</div>
