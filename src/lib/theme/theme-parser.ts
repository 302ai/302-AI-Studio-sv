/**
 * Theme variable parser - extracts and categorizes CSS variables from ds.css
 */

import type { ThemeVariable, ThemeCategory, ThemeConfig, VariableType } from "./theme-types.js";
import { TYPE_PATTERNS, THEME_CATEGORIES } from "./theme-types.js";

/**
 * Parse CSS content and extract --ui-* variables
 */
export function parseCssVariables(cssContent: string): Record<string, string> {
	const variables: Record<string, string> = {};
	const cleanCss = cssContent.replace(/\/\*[\s\S]*?\*\//g, "");

	const allVarMatches = cleanCss.matchAll(/(--ui-[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g);

	for (const match of allVarMatches) {
		const [, name, value] = match;
		if (name && value) {
			const cleanName = name.trim();
			const cleanValue = value.trim();
			if (!cleanValue.includes("@theme") && !cleanName.includes("bridge")) {
				if (!variables[cleanName]) {
					variables[cleanName] = cleanValue;
				} else {
					const existingHasVar =
						variables[cleanName].includes("var(") || variables[cleanName].includes("calc(");
					const newHasVar = cleanValue.includes("var(") || cleanValue.includes("calc(");

					if (existingHasVar && !newHasVar) {
						variables[cleanName] = cleanValue;
					}
				}
			}
		}
	}

	return variables;
}

/**
 * Determine variable type based on name patterns
 */
function getVariableType(name: string): VariableType {
	for (const [type, pattern] of Object.entries(TYPE_PATTERNS)) {
		if (pattern.test(name)) {
			return type as VariableType;
		}
	}
	return "spacing";
}

/**
 * Generate human-readable label from variable name
 */
function generateLabel(name: string): string {
	return name
		.replace(/^--ui-/, "")
		.replace(/-/g, " ")
		.replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Get category for a variable based on its type and name
 */
function getVariableCategory(name: string, type: VariableType): string {
	if (type === "color") return THEME_CATEGORIES.colors.name;
	if (type === "radius") return THEME_CATEGORIES.geometry.name;
	if (type === "text") return THEME_CATEGORIES.typography.name;
	if (
		name.includes("-tab-") ||
		name.includes("-chat-") ||
		name.includes("-settings-") ||
		name.includes("-seg-")
	) {
		return THEME_CATEGORIES.components.name;
	}

	return THEME_CATEGORIES.layout.name;
}

/**
 * Parse numeric value with unit
 */
function parseNumericValue(value: string): { num: number; unit: string } {
	const match = value.match(/^([0-9.]+)(.*)$/);
	if (match) {
		return {
			num: parseFloat(match[1]),
			unit: match[2].trim() || "",
		};
	}
	return { num: 0, unit: "" };
}

/**
 * Get appropriate min/max/step values for numeric variables
 */
function getNumericConstraints(
	name: string,
	type: VariableType,
	unit: string,
	currentValue?: number,
): {
	min?: number;
	max?: number;
	step?: number;
} {
	if (type === "density") {
		return { min: 0.5, max: 2, step: 0.1 };
	}

	if (unit === "rem") {
		if (name.includes("radius")) {
			const dynamicMax = currentValue ? Math.max(currentValue * 2, 2) : 2;
			return { min: 0, max: dynamicMax, step: 0.125 };
		}
		if (name.includes("height") || name.includes("-h")) {
			const dynamicMax = currentValue ? Math.max(currentValue * 1.5, 8) : 8;
			return { min: 0, max: dynamicMax, step: 0.25 };
		}
		if (
			name.includes("width") ||
			name.includes("-w") ||
			name.includes("max-w") ||
			name.includes("min-w")
		) {
			const dynamicMax = currentValue ? Math.max(currentValue * 1.5, 50) : 50;
			return { min: 0, max: dynamicMax, step: 0.25 };
		}
		if (currentValue && currentValue > 10) {
			return { min: 0, max: Math.max(currentValue * 1.5, 50), step: 0.25 };
		}
		if (currentValue && currentValue > 4) {
			return { min: 0, max: Math.max(currentValue * 1.5, 20), step: 0.125 };
		}

		return { min: 0, max: 4, step: 0.125 };
	}

	if (unit === "px") {
		return { min: 0, max: 100, step: 1 };
	}

	return {};
}

/**
 * Get preset values for common variables
 */
function getPresets(name: string, type: VariableType): string[] | undefined {
	if (type === "radius") {
		return ["0", "0.125rem", "0.25rem", "0.375rem", "0.5rem", "0.625rem", "1rem"];
	}

	if (name.includes("density")) {
		return ["0.8", "0.9", "1", "1.1", "1.2"];
	}

	return undefined;
}

/**
 * Convert parsed variables to ThemeVariable objects
 */
function createThemeVariable(name: string, value: string): ThemeVariable {
	const type = getVariableType(name);
	const category = getVariableCategory(name, type);
	const label = generateLabel(name);

	const variable: ThemeVariable = {
		name,
		type,
		category,
		label,
		defaultValue: value,
		currentValue: value,
	};
	if (type === "size" || type === "spacing" || type === "density") {
		const { num, unit } = parseNumericValue(value);
		if (num > 0) {
			variable.unit = unit;
			const constraints = getNumericConstraints(name, type, unit, num);
			Object.assign(variable, constraints);
		}
	}
	const presets = getPresets(name, type);
	if (presets) {
		variable.presets = presets;
	}

	return variable;
}

/**
 * Main parsing function - convert CSS to theme config
 */
export function parseThemeConfig(cssContent: string): ThemeConfig {
	const variables = parseCssVariables(cssContent);
	const themeVariables = Object.entries(variables).map(([name, value]) =>
		createThemeVariable(name, value),
	);
	const categoryMap = new Map<string, ThemeVariable[]>();

	for (const variable of themeVariables) {
		if (!categoryMap.has(variable.category)) {
			categoryMap.set(variable.category, []);
		}
		categoryMap.get(variable.category)!.push(variable);
	}
	const categories: ThemeCategory[] = [];

	for (const [categoryName, vars] of categoryMap) {
		const categoryInfo = Object.values(THEME_CATEGORIES).find((c) => c.name === categoryName);
		if (categoryInfo) {
			categories.push({
				name: categoryName,
				label: categoryInfo.label,
				description: categoryInfo.description,
				variables: vars.sort((a, b) => a.name.localeCompare(b.name)),
			});
		}
	}
	const categoryOrder = ["colors", "layout", "components", "typography", "geometry"];
	categories.sort((a, b) => {
		const aIndex = categoryOrder.indexOf(a.name);
		const bIndex = categoryOrder.indexOf(b.name);
		return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
	});

	return { categories };
}
