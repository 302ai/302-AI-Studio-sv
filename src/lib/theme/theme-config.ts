/**
 * Theme configuration generator - loads and parses theme variables
 */

import type { ThemeConfig } from "./theme-types.js";
import { parseThemeConfig } from "./theme-parser.js";
import dsCssContent from "./ds.css?inline";

let cachedConfig: ThemeConfig | null = null;

/**
 * Load theme configuration by parsing ds.css
 */
export async function loadThemeConfig(): Promise<ThemeConfig> {
	if (cachedConfig) {
		return cachedConfig;
	}

	try {
		cachedConfig = parseThemeConfig(dsCssContent);
	} catch (error) {
		console.warn("Failed to load theme configuration:", error);
		cachedConfig = { categories: [] };
	}

	return cachedConfig;
}

/**
 * Reset cached config (useful for development)
 */
export function resetThemeConfig(): void {
	cachedConfig = null;
}

/**
 * Hardcoded theme configuration as fallback
 * This includes the most commonly used --ui-* variables
 */
const FALLBACK_CONFIG: ThemeConfig = {
	categories: [
		{
			name: "colors",
			label: "Colors",
			description: "Color scheme and surface colors",
			variables: [
				{
					name: "--ui-accent",
					type: "color",
					category: "colors",
					label: "Accent Color",
					description: "Primary accent color used for buttons and highlights",
					defaultValue: "var(--accent)",
				},
				{
					name: "--ui-accent-fg",
					type: "color",
					category: "colors",
					label: "Accent Foreground",
					description: "Text color on accent backgrounds",
					defaultValue: "var(--accent-foreground)",
				},
				{
					name: "--ui-surface",
					type: "color",
					category: "colors",
					label: "Surface",
					description: "Main background surface color",
					defaultValue: "var(--background)",
				},
				{
					name: "--ui-surface-muted",
					type: "color",
					category: "colors",
					label: "Surface Muted",
					description: "Muted background color",
					defaultValue: "var(--muted)",
				},
				{
					name: "--ui-text",
					type: "color",
					category: "colors",
					label: "Text",
					description: "Primary text color",
					defaultValue: "var(--foreground)",
				},
				{
					name: "--ui-text-muted",
					type: "color",
					category: "colors",
					label: "Text Muted",
					description: "Muted text color",
					defaultValue: "var(--muted-foreground)",
				},
			],
		},
		{
			name: "geometry",
			label: "Geometry",
			description: "Border radius and shape settings",
			variables: [
				{
					name: "--ui-radius",
					type: "radius",
					category: "geometry",
					label: "Border Radius",
					description: "Global border radius for components",
					defaultValue: "0.375rem",
					unit: "rem",
					min: 0,
					max: 2,
					step: 0.125,
					presets: ["0", "0.125rem", "0.25rem", "0.375rem", "0.5rem", "0.625rem", "1rem"],
				},
			],
		},
		{
			name: "layout",
			label: "Layout",
			description: "Spacing, sizing and layout properties",
			variables: [
				{
					name: "--ui-density",
					type: "density",
					category: "layout",
					label: "Density",
					description: "Scale factor for component compactness",
					defaultValue: "1",
					min: 0.5,
					max: 2,
					step: 0.1,
					presets: ["0.8", "0.9", "1", "1.1", "1.2"],
				},
			],
		},
	],
};

/**
 * Get theme configuration with fallback
 */
export async function getThemeConfig(): Promise<ThemeConfig> {
	try {
		const config = await loadThemeConfig();

		if (config.categories.length === 0) {
			return FALLBACK_CONFIG;
		}
		return config;
	} catch {
		return FALLBACK_CONFIG;
	}
}
