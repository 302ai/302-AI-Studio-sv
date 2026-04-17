<script lang="ts">
	import { cn } from "$lib/utils";
	import {
		ArcElement,
		Chart,
		DoughnutController,
		Legend,
		PieController,
		Tooltip,
	} from "chart.js";
	import { onMount } from "svelte";
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../card";
	import {
		buildCircularOptions,
		buildDoughnutData,
		buildPieData,
		getChartThemeTokens,
	} from "./chartjs-theme";

	Chart.register(DoughnutController, PieController, ArcElement, Tooltip, Legend);

	interface Props {
		labels: string[];
		data: number[];
		title?: string;
		description?: string;
		class?: string;
		height?: number;
		showLegend?: boolean;
		variant?: "doughnut" | "pie";
	}

	let {
		labels,
		data,
		title,
		description,
		class: className,
		height = 320,
		showLegend = true,
		variant = "doughnut",
	}: Props = $props();

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let wrapperEl = $state<HTMLDivElement | null>(null);
	let chart: Chart<"doughnut", number[], string> | Chart<"pie", number[], string> | null = null;
	let themeObserver: MutationObserver | null = null;

	function renderChart() {
		if (!canvasEl || !wrapperEl) return;
		const tokens = getChartThemeTokens(wrapperEl);
		chart?.destroy();
		if (variant === "pie") {
			const chartData = buildPieData(labels, data, tokens);
			const options = buildCircularOptions(
				tokens,
				showLegend,
			) as import("chart.js").ChartOptions<"pie">;
			chart = new Chart(canvasEl, { type: "pie", data: chartData, options });
			return;
		}

		const chartData = buildDoughnutData(labels, data, tokens);
		const options = buildCircularOptions(tokens, showLegend, {
			cutout: "62%",
		}) as import("chart.js").ChartOptions<"doughnut">;
		chart = new Chart(canvasEl, { type: "doughnut", data: chartData, options });
	}

	onMount(() => {
		renderChart();

		themeObserver = new MutationObserver(() => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					renderChart();
				});
			});
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});

		return () => {
			themeObserver?.disconnect();
			chart?.destroy();
		};
	});

	$effect(() => {
		const deps = [labels, data, showLegend, variant];
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
