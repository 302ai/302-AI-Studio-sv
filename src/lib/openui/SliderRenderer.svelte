<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Slider from "$lib/components/ui/slider/slider.svelte";

	type OpenUISliderProps = {
		class?: string;
		value?: number[];
		min?: number;
		max?: number;
		step?: number;
		disabled?: boolean;
		orientation?: "horizontal" | "vertical";
		type?: "single" | "multiple";
	};

	let { props }: ComponentRenderProps<OpenUISliderProps> = $props();
</script>

{#if (props.type ?? (props.value?.length && props.value.length > 1 ? "multiple" : "single")) === "multiple"}
	<Slider
		class={props.class}
		value={props.value ?? [0, 100]}
		min={props.min}
		max={props.max}
		step={props.step}
		disabled={props.disabled}
		orientation={props.orientation}
		type="multiple"
	/>
{:else}
	<Slider
		class={props.class}
		value={props.value?.[0] ?? 0}
		min={props.min}
		max={props.max}
		step={props.step}
		disabled={props.disabled}
		orientation={props.orientation}
		type="single"
	/>
{/if}
