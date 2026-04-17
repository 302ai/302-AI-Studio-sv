<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import type { SimpleChartDataset } from "$lib/components/ui/chart/chartjs-theme";
	import LineChart from "$lib/components/ui/chart/line-chart.svelte";

	type OpenUILineChartProps = {
		title?: string;
		description?: string;
		labels?: string[];
		series?: Array<{
			label?: string;
			values: number[];
			color?: string;
			fill?: boolean;
		}>;
		height?: number;
		showLegend?: boolean;
		class?: string;
	};

	let { props }: ComponentRenderProps<OpenUILineChartProps> = $props();

	const datasets = $derived<SimpleChartDataset[]>(
		(props.series ?? []).map((series) => ({
			label: series.label,
			data: series.values,
			color: series.color,
			fill: series.fill,
		})),
	);
</script>

<LineChart
	title={props.title}
	description={props.description}
	labels={props.labels ?? []}
	{datasets}
	height={props.height}
	showLegend={props.showLegend}
	class={props.class}
/>
