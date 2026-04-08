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
	label: string;
	legendLabel: string;
	grid: string;
	border: string;
	background: string;
	card: string;
	primary: string;
	chartColors: string[];
};

function getThemeDefaults() {
	if (typeof document === "undefined") {
		return {
			foreground: "rgb(51, 51, 51)",
			background: "rgb(255, 255, 255)",
			border: "rgb(217, 217, 217)",
			primary: "rgb(142, 71, 240)",
		};
	}

	const isDark = document.documentElement.classList.contains("dark");
	return isDark
		? {
				foreground: "rgb(230, 230, 230)",
				background: "rgb(18, 18, 18)",
				border: "rgb(61, 61, 61)",
				primary: "rgb(142, 71, 240)",
			}
		: {
				foreground: "rgb(51, 51, 51)",
				background: "rgb(255, 255, 255)",
				border: "rgb(217, 217, 217)",
				primary: "rgb(142, 71, 240)",
			};
}

function resolveCssColor(value: string, fallback: string, element?: HTMLElement) {
	if (typeof window === "undefined") return fallback;
	const probe = document.createElement("span");
	probe.style.color = fallback;
	probe.style.color = value;
	(element ?? document.body ?? document.documentElement).appendChild(probe);
	const resolved = getComputedStyle(probe).color || fallback;
	probe.remove();
	return resolved;
}

function cssVar(name: string, fallback: string, element?: HTMLElement) {
	if (typeof window === "undefined") return fallback;
	const target = element ?? document.documentElement;
	const value = getComputedStyle(target).getPropertyValue(name).trim();
	return resolveCssColor(value || fallback, fallback, element);
}

function alphaColor(color: string, alpha: string) {
	const alphaValue = Math.min(Math.max(Number(alpha), 0), 1);
	const match = color.match(/rgba?\(([^)]+)\)/i);
	if (match) {
		const parts = match[1].split(",").map((part) => part.trim());
		const [r = "0", g = "0", b = "0"] = parts;
		return `rgba(${r}, ${g}, ${b}, ${alphaValue})`;
	}
	return color;
}

function mergeChartOptions<T extends Record<string, unknown>>(
	base: T,
	extra: Record<string, unknown>,
) {
	const result: Record<string, unknown> = { ...base };

	for (const [key, value] of Object.entries(extra)) {
		if (
			value &&
			typeof value === "object" &&
			!Array.isArray(value) &&
			result[key] &&
			typeof result[key] === "object" &&
			!Array.isArray(result[key])
		) {
			result[key] = mergeChartOptions(
				result[key] as Record<string, unknown>,
				value as Record<string, unknown>,
			);
		} else {
			result[key] = value;
		}
	}

	return result as T;
}

function resolveDatasetColor(color: string | undefined, fallback: string, element?: HTMLElement) {
	return resolveCssColor(color || fallback, fallback, element);
}

export function getChartThemeTokens(element?: HTMLElement): ChartThemeTokens {
	const defaults = getThemeDefaults();
	const foreground = cssVar("--foreground", defaults.foreground, element);
	const border = cssVar("--border", defaults.border, element);
	const card = cssVar("--card", defaults.background, element);
	const legendLabel = alphaColor(foreground, "0.92");
	const label = alphaColor(
		foreground,
		document.documentElement.classList.contains("dark") ? "0.82" : "0.72",
	);

	return {
		foreground,
		mutedForeground: cssVar("--muted-foreground", alphaColor(foreground, "0.65"), element),
		label,
		legendLabel,
		grid: alphaColor(
			border,
			document.documentElement.classList.contains("dark") ? "0.95" : "0.9",
		),
		border,
		background: cssVar("--background", defaults.background, element),
		card,
		primary: cssVar("--primary", defaults.primary, element),
		chartColors: [1, 2, 3, 4, 5].map((index) =>
			cssVar(`--chart-${index}`, defaults.primary, element),
		),
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
	const baseOptions: ChartOptions<"bar" | "line"> = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: showLegend,
				labels: {
					color: tokens.legendLabel,
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
				grid: { color: tokens.grid },
				ticks: { color: tokens.label, font: { size: 11, weight: 400 } },
				border: { display: false },
			},
			y: {
				grid: { color: tokens.grid },
				ticks: { color: tokens.label, font: { size: 11, weight: 400 } },
				border: { display: false },
			},
		},
	};

	return mergeChartOptions(baseOptions, extra);
}

export function buildCircularOptions(
	tokens: ChartThemeTokens,
	showLegend: boolean,
	extra: Record<string, unknown> = {},
): ChartOptions<"doughnut" | "pie"> {
	const baseOptions: ChartOptions<"doughnut" | "pie"> = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: showLegend,
				position: "bottom",
				labels: {
					color: tokens.legendLabel,
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
	};

	return mergeChartOptions(baseOptions, extra);
}

export function buildBarDatasets(
	datasets: SimpleChartDataset[],
	tokens: ChartThemeTokens,
	element?: HTMLElement,
): ChartDataset<"bar", number[]>[] {
	return datasets.map((dataset, index) => {
		const baseColor =
			dataset.color ||
			tokens.chartColors[index % tokens.chartColors.length] ||
			tokens.primary;
		const color = resolveDatasetColor(baseColor, tokens.primary, element);
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
	element?: HTMLElement,
): ChartDataset<"line", number[]>[] {
	return datasets.map((dataset, index) => {
		const baseColor =
			dataset.color ||
			tokens.chartColors[index % tokens.chartColors.length] ||
			tokens.primary;
		const color = resolveDatasetColor(baseColor, tokens.primary, element);
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
