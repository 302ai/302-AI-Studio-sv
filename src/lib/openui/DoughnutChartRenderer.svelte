<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import DoughnutChart from "$lib/components/ui/chart/doughnut-chart.svelte";

	type OpenUIDoughnutChartProps = {
		title?: string;
		description?: string;
		items?: Array<{
			label: string;
			value: number;
			color?: string;
		}>;
		height?: number;
		showLegend?: boolean;
		class?: string;
	};

	let { props }: ComponentRenderProps<OpenUIDoughnutChartProps> = $props();

	const labels = $derived((props.items ?? []).map((item) => item.label));
	const data = $derived((props.items ?? []).map((item) => item.value));
</script>

<DoughnutChart
	title={props.title}
	description={props.description}
	{labels}
	{data}
	height={props.height}
	showLegend={props.showLegend}
	class={props.class}
/>
