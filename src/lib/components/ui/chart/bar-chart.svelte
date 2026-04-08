<script lang="ts">
	import { cn } from "$lib/utils";
	import {
		BarController,
		BarElement,
		CategoryScale,
		Chart,
		type ChartData,
		Legend,
		LinearScale,
		Tooltip,
	} from "chart.js";
	import { onMount } from "svelte";
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../card";
	import {
		buildBarDatasets,
		buildCartesianOptions,
		getChartThemeTokens,
		type SimpleChartDataset,
	} from "./chartjs-theme";

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	interface Props {
		labels: string[];
		datasets: SimpleChartDataset[];
		title?: string;
		description?: string;
		class?: string;
		height?: number;
		showLegend?: boolean;
	}

	let {
		labels,
		datasets,
		title,
		description,
		class: className,
		height = 320,
		showLegend = true,
	}: Props = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let wrapperEl = $state<HTMLDivElement | null>(null);
	let chart: Chart<"bar"> | null = null;

	function renderChart() {
		if (!canvasEl || !wrapperEl) return;
		const tokens = getChartThemeTokens(wrapperEl);
		const data: ChartData<"bar"> = {
			labels,
			datasets: buildBarDatasets(datasets, tokens),
		};
		const options = buildCartesianOptions(tokens, showLegend, {
			scales: {
				x: { stacked: false },
				y: { beginAtZero: true },
			},
		}) as import("chart.js").ChartOptions<"bar">;

		chart?.destroy();
		chart = new Chart(canvasEl, { type: "bar", data, options });
	}

	onMount(() => {
		renderChart();
		return () => chart?.destroy();
	});

	$effect(() => {
		const deps = [labels, datasets, showLegend];
		void deps;
		renderChart();
	});
</script>

<Card class={cn("overflow-hidden", className)}>
	{#if title || description}
		<CardHeader>
			{#if title}<CardTitle>{title}</CardTitle>{/if}
			{#if description}<CardDescription>{description}</CardDescription>{/if}
		</CardHeader>
	{/if}
	<CardContent>
		<div bind:this={wrapperEl} style={`height:${height}px`} class="relative w-full">
			<canvas bind:this={canvasEl}></canvas>
		</div>
	</CardContent>
</Card>
