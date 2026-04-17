<script lang="ts">
	import { cn } from "$lib/utils";
	import {
		CategoryScale,
		Chart,
		type ChartData,
		Legend,
		LineController,
		LineElement,
		LinearScale,
		PointElement,
		Tooltip,
	} from "chart.js";
	import { onMount } from "svelte";
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../card";
	import {
		buildCartesianOptions,
		buildLineDatasets,
		getChartThemeTokens,
		type SimpleChartDataset,
	} from "./chartjs-theme";

	Chart.register(
		LineController,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Legend,
	);

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
	let chart: Chart<"line"> | null = null;

	function renderChart() {
		if (!canvasEl || !wrapperEl) return;
		const tokens = getChartThemeTokens(wrapperEl);
		const data: ChartData<"line"> = {
			labels,
			datasets: buildLineDatasets(
				datasets.map((dataset) => ({ ...dataset, fill: dataset.fill ?? true })),
				tokens,
			),
		};
		const options = buildCartesianOptions(tokens, showLegend, {
			elements: {
				line: { tension: 0.35 },
				point: { radius: 3, hoverRadius: 5 },
			},
			scales: {
				x: { grid: { display: false } },
				y: { beginAtZero: true },
			},
		}) as import("chart.js").ChartOptions<"line">;

		chart?.destroy();
		chart = new Chart(canvasEl, { type: "line", data, options });
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
