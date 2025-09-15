/**
 * Theme variable types and definitions for the visual theme editor
 */

export type VariableType = "color" | "size" | "spacing" | "radius" | "density" | "text";

export interface ThemeVariable {
	name: string;
	type: VariableType;
	category: string;
	label: string;
	description?: string;
	defaultValue: string;
	currentValue?: string;
	min?: number;
	max?: number;
	step?: number;
	unit?: string;
	presets?: string[];
}

export interface ThemeCategory {
	name: string;
	label: string;
	description?: string;
	variables: ThemeVariable[];
}

export interface ThemeConfig {
	categories: ThemeCategory[];
}

/**
 * Variable type detection patterns
 */
export const TYPE_PATTERNS = {
	color: /^--ui-(accent|surface|text|bg|fg|border|chat.*-(hover|active)|tab.*-(bg|fg|hover|btn))/,
	size: /^--ui-.*-(size|width|height|w|h|max-w|min-w|max-h|min-h)$/,
	spacing: /^--ui-.*-(padding|margin|gap|x|y|px|py|pad|pt)$/,
	radius: /^--ui-.*-radius$/,
	density: /^--ui-density$/,
	text: /^--ui-.*-(text|font)/,
} as const;

/**
 * Category definitions
 * Note: Labels and descriptions are now handled by i18n in the UI components
 */
export const THEME_CATEGORIES = {
	colors: {
		name: "colors",
		label: "Colors",
		description: "Color scheme and surface colors",
	},
	layout: {
		name: "layout",
		label: "Layout",
		description: "Spacing, sizing and layout properties",
	},
	components: {
		name: "components",
		label: "Components",
		description: "Component-specific styling",
	},
	typography: {
		name: "typography",
		label: "Typography",
		description: "Text and font settings",
	},
	geometry: {
		name: "geometry",
		label: "Geometry",
		description: "Border radius and shape settings",
	},
} as const;
