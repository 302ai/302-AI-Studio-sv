<script lang="ts" module>
	import type { ThemeCategory, ThemeVariable } from "$lib/theme/theme-types.js";

	interface Props {
		category: ThemeCategory;
		onVariableChange?: (variable: ThemeVariable, value: string) => void;
	}
</script>

<script lang="ts">
	import * as Accordion from "$lib/components/ui/accordion";
	import ColorEditor from "./color-editor.svelte";
	import NumericEditor from "./numeric-editor.svelte";
	import { Badge } from "$lib/components/ui/badge";
	import { Palette, Ruler, Move, Circle, Grid3X3, Type, Settings } from "@lucide/svelte";
	import { m } from "$lib/paraglide/messages.js";

	const { category, onVariableChange }: Props = $props();

	function handleVariableChange(variable: ThemeVariable, value: string) {
		variable.currentValue = value;
		onVariableChange?.(variable, value);
	}

	function getVariableCount(category: ThemeCategory): number {
		return category.variables.length;
	}

	function getVariableTypeIcon(type: string) {
		switch (type) {
			case "color":
				return Palette;
			case "size":
				return Ruler;
			case "spacing":
				return Move;
			case "radius":
				return Circle;
			case "density":
				return Grid3X3;
			case "text":
				return Type;
			default:
				return Settings;
		}
	}

	function getCategoryLabel(categoryName: string): string {
		switch (categoryName) {
			case "colors":
				return m.text_theme_category_colors();
			case "layout":
				return m.text_theme_category_layout();
			case "components":
				return m.text_theme_category_components();
			case "typography":
				return m.text_theme_category_typography();
			case "geometry":
				return m.text_theme_category_geometry();
			default:
				return category.label;
		}
	}

	function getCategoryDescription(categoryName: string): string {
		switch (categoryName) {
			case "colors":
				return m.text_theme_category_colors_desc();
			case "layout":
				return m.text_theme_category_layout_desc();
			case "components":
				return m.text_theme_category_components_desc();
			case "typography":
				return m.text_theme_category_typography_desc();
			case "geometry":
				return m.text_theme_category_geometry_desc();
			default:
				return category.description || "";
		}
	}
</script>

<Accordion.Item value={category.name}>
	<Accordion.Trigger class="text-left">
		<div class="flex w-full items-center justify-between pr-4">
			<div class="flex items-center gap-2">
				<span class="font-medium">{getCategoryLabel(category.name)}</span>
				<Badge variant="secondary" class="text-xs">
					{getVariableCount(category)}
				</Badge>
			</div>
		</div>
		{@const description = getCategoryDescription(category.name)}
		{#if description}
			<p class="text-muted-foreground mt-1 text-sm">{description}</p>
		{/if}
	</Accordion.Trigger>

	<Accordion.Content class="space-y-4 pt-4">
		{#each category.variables as variable (variable.name)}
			{@const IconComponent = getVariableTypeIcon(variable.type)}
			<div class="border-border/50 bg-card rounded-lg border p-5">
				<div class="mb-4 flex items-start gap-3">
					<div
						class="bg-muted/50 text-muted-foreground mt-0.5 flex h-6 w-6 items-center justify-center rounded-md"
						title={variable.type}
					>
						<IconComponent class="h-4 w-4" />
					</div>
					<div class="min-w-0 flex-1">
						<div class="mb-2 flex items-center gap-3">
							<h4 class="text-foreground text-sm font-medium">{variable.label}</h4>
							<Badge variant="outline" class="shrink-0 font-mono text-xs">
								{variable.name}
							</Badge>
						</div>
						{#if variable.description}
							<p class="text-muted-foreground text-xs">{variable.description}</p>
						{/if}
					</div>
				</div>

				<!-- Variable editor based on type -->
				{#if variable.type === "color"}
					{@const currentValue = variable.currentValue ?? variable.defaultValue}
					<ColorEditor
						label=""
						value={currentValue}
						onValueChange={(value) => handleVariableChange(variable, value)}
					/>
				{:else if variable.type === "size" || variable.type === "spacing" || variable.type === "radius" || variable.type === "density"}
					{@const currentValue = variable.currentValue ?? variable.defaultValue}
					<NumericEditor
						label=""
						value={currentValue}
						min={variable.min}
						max={variable.max}
						step={variable.step}
						unit={variable.unit}
						presets={variable.presets}
						onValueChange={(value) => handleVariableChange(variable, value)}
					/>
				{:else}
					{@const currentValue = variable.currentValue ?? variable.defaultValue}
					<!-- Fallback for other types - simple text input -->
					<div class="space-y-2">
						<input
							type="text"
							value={currentValue}
							onchange={(e) => handleVariableChange(variable, e.currentTarget.value)}
							class="border-input w-full rounded-md border px-3 py-2 font-mono text-sm"
							placeholder={variable.defaultValue}
						/>
						<div class="text-muted-foreground text-xs">
							{m.text_theme_variable_default()}
							<span class="font-mono">{variable.defaultValue}</span>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</Accordion.Content>
</Accordion.Item>
