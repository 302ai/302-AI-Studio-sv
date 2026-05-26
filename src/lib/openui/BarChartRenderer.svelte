<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import type { SimpleChartDataset } from "$lib/components/ui/chart/chartjs-theme";
	import BarChart from "$lib/components/ui/chart/bar-chart.svelte";

	type OpenUIBarChartProps = {
		title?: string;
		description?: string;
		labels?: string[];
		series?: Array<{
			label?: string;
			values: number[];
			color?: string;
		}>;
		height?: number;
		showLegend?: boolean;
		class?: string;
	};

	let { props }: ComponentRenderProps<OpenUIBarChartProps> = $props();

	const datasets = $derived<SimpleChartDataset[]>(
		(props.series ?? []).map((series) => ({
			label: series.label,
			data: series.values,
			color: series.color,
		})),
	);
</script>

<BarChart
	title={props.title}
	description={props.description}
	labels={props.labels ?? []}
	{datasets}
	height={props.height}
	showLegend={props.showLegend}
	class={props.class}
/>
