import type {
	ChartData,
	ChartDataset,
	ChartOptions,
	TooltipItem,
	Chart as ChartInstance,
} from "chart.js";

export type SimpleChartDataset = {
	label?: string;
	data: number[];
	color?: string;
	fill?: boolean;
};

export type ChartThemeTokens = {
	foreground: string;
	mutedForeground: string;
	border: string;
	background: string;
	card: string;
	primary: string;
	chartColors: string[];
};

function cssVar(name: string, fallback: string, element?: HTMLElement) {
	if (typeof window === "undefined") return fallback;
	const target = element ?? document.documentElement;
	const value = getComputedStyle(target).getPropertyValue(name).trim();
	return value || fallback;
}

function alphaColor(color: string, alpha: string) {
	if (color.startsWith("#")) {
		const hex = color.replace("#", "");
		const normalized =
			hex.length === 3
				? hex
						.split("")
						.map((part) => part + part)
						.join("")
				: hex;
		const opacity = Math.round(Number(alpha) * 255)
			.toString(16)
			.padStart(2, "0");
		return `#${normalized}${opacity}`;
	}
	return color;
}

export function getChartThemeTokens(element?: HTMLElement): ChartThemeTokens {
	return {
		foreground: cssVar("--foreground", "#e6e6e6", element),
		mutedForeground: cssVar("--muted-foreground", "#aaaaaa", element),
		border: cssVar("--border", "#3d3d3d", element),
		background: cssVar("--background", "#121212", element),
		card: cssVar("--card", "#1a1a1a", element),
		primary: cssVar("--primary", "#8e47f0", element),
		chartColors: [1, 2, 3, 4, 5].map((index) => cssVar(`--chart-${index}`, "#8e47f0", element)),
	};
}

function tooltipLabel(item: TooltipItem<"bar" | "line" | "doughnut" | "pie">) {
	const datasetLabel = typeof item.dataset.label === "string" ? `${item.dataset.label}: ` : "";
	return `${datasetLabel}${item.formattedValue}`;
}

export function buildCartesianOptions(
	tokens: ChartThemeTokens,
	showLegend: boolean,
	extra: Record<string, unknown> = {},
): ChartOptions<"bar" | "line"> {
	return {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: showLegend,
				labels: {
					color: tokens.foreground,
					usePointStyle: true,
					boxWidth: 10,
					boxHeight: 10,
					padding: 16,
					font: { size: 12, weight: 500 },
				},
			},
			tooltip: {
				backgroundColor: tokens.card,
				titleColor: tokens.foreground,
				bodyColor: tokens.foreground,
				borderColor: tokens.border,
				borderWidth: 1,
				padding: 12,
				displayColors: true,
				callbacks: { label: tooltipLabel },
			},
		},
		scales: {
			x: {
				grid: { color: alphaColor(tokens.border, "0.55") },
				ticks: { color: tokens.mutedForeground, font: { size: 11 } },
				border: { display: false },
			},
			y: {
				grid: { color: alphaColor(tokens.border, "0.55") },
				ticks: { color: tokens.mutedForeground, font: { size: 11 } },
				border: { display: false },
			},
		},
		...extra,
	};
}

export function buildCircularOptions(
	tokens: ChartThemeTokens,
	showLegend: boolean,
	extra: Record<string, unknown> = {},
): ChartOptions<"doughnut" | "pie"> {
	return {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: showLegend,
				position: "bottom",
				labels: {
					color: tokens.foreground,
					usePointStyle: true,
					boxWidth: 10,
					boxHeight: 10,
					padding: 16,
					font: { size: 12, weight: 500 },
				},
			},
			tooltip: {
				backgroundColor: tokens.card,
				titleColor: tokens.foreground,
				bodyColor: tokens.foreground,
				borderColor: tokens.border,
				borderWidth: 1,
				padding: 12,
				displayColors: true,
				callbacks: { label: tooltipLabel },
			},
		},
		...extra,
	};
}

export function buildBarDatasets(
	datasets: SimpleChartDataset[],
	tokens: ChartThemeTokens,
): ChartDataset<"bar", number[]>[] {
	return datasets.map((dataset, index) => {
		const color =
			dataset.color ||
			tokens.chartColors[index % tokens.chartColors.length] ||
			tokens.primary;
		return {
			label: dataset.label,
			data: dataset.data,
			borderColor: color,
			backgroundColor: alphaColor(color, "0.8"),
			hoverBackgroundColor: color,
			borderWidth: 1,
			maxBarThickness: 40,
			borderRadius: 8,
		};
	});
}

export function buildLineDatasets(
	datasets: SimpleChartDataset[],
	tokens: ChartThemeTokens,
): ChartDataset<"line", number[]>[] {
	return datasets.map((dataset, index) => {
		const color =
			dataset.color ||
			tokens.chartColors[index % tokens.chartColors.length] ||
			tokens.primary;
		return {
			label: dataset.label,
			data: dataset.data,
			borderColor: color,
			backgroundColor: alphaColor(color, (dataset.fill ?? true) ? "0.18" : "0"),
			pointBackgroundColor: color,
			pointBorderColor: tokens.card,
			pointRadius: 3,
			pointHoverRadius: 5,
			fill: dataset.fill ?? true,
			tension: 0.35,
			borderWidth: 2,
		};
	});
}

export function buildDoughnutData(
	labels: string[],
	data: number[],
	tokens: ChartThemeTokens,
): ChartData<"doughnut", number[], string> {
	const palette = labels.map((_, index) => tokens.chartColors[index % tokens.chartColors.length]);
	return {
		labels,
		datasets: [
			{
				data,
				backgroundColor: palette,
				borderColor: tokens.card,
				borderWidth: 2,
				hoverOffset: 6,
			},
		],
	};
}

export function buildPieData(
	labels: string[],
	data: number[],
	tokens: ChartThemeTokens,
): ChartData<"pie", number[], string> {
	const palette = labels.map((_, index) => tokens.chartColors[index % tokens.chartColors.length]);
	return {
		labels,
		datasets: [
			{
				data,
				backgroundColor: palette,
				borderColor: tokens.card,
				borderWidth: 2,
				hoverOffset: 6,
			},
		],
	};
}

export function destroyChart(chart: ChartInstance | null) {
	chart?.destroy();
}
