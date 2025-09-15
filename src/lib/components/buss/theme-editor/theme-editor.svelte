<script lang="ts">
	import { onMount } from "svelte";
	import * as Accordion from "$lib/components/ui/accordion";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Badge } from "$lib/components/ui/badge";
	import * as Alert from "$lib/components/ui/alert";
	import CategoryPanel from "./category-panel.svelte";
	import { getThemeConfig } from "$lib/theme/theme-config.js";
	import { applyUserVars } from "$lib/theme/user-theme.js";
	import type { ThemeConfig, ThemeVariable } from "$lib/theme/theme-types.js";
	import { Search, Download, Upload, RotateCcw, Info } from "@lucide/svelte";
	import { m } from "$lib/paraglide/messages.js";

	let themeConfig: ThemeConfig = $state({ categories: [] });
	let searchQuery = $state("");
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	const STORAGE_KEY = "user-theme-variables";

	onMount(async () => {
		try {
			themeConfig = await getThemeConfig();
			for (const category of themeConfig.categories) {
				for (const variable of category.variables) {
					if (variable.currentValue === undefined) {
						variable.currentValue = variable.defaultValue;
					}
				}
			}

			loadUserTheme();
		} catch (error) {
			console.error("Failed to load theme config:", error);
			loadError = "Failed to load theme configuration";
		} finally {
			isLoading = false;
		}
	});

	function loadUserTheme() {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const userVars = JSON.parse(saved);

				for (const category of themeConfig.categories) {
					for (const variable of category.variables) {
						if (userVars[variable.name]) {
							variable.currentValue = userVars[variable.name];
						}
					}
				}

				applyUserVars(userVars);
			}
		} catch (error) {
			console.warn("Failed to load saved theme:", error);
		}
	}

	function saveUserTheme() {
		try {
			const userVars: Record<string, string> = {};
			for (const category of themeConfig.categories) {
				for (const variable of category.variables) {
					if (variable.currentValue !== variable.defaultValue) {
						userVars[variable.name] = variable.currentValue || variable.defaultValue;
					}
				}
			}
			localStorage.setItem(STORAGE_KEY, JSON.stringify(userVars));
			applyUserVars(userVars);
		} catch (error) {
			console.error("Failed to save theme:", error);
		}
	}

	function handleVariableChange(variable: ThemeVariable, value: string) {
		variable.currentValue = value;
		saveUserTheme();
	}

	function resetAllToDefaults() {
		for (const category of themeConfig.categories) {
			for (const variable of category.variables) {
				variable.currentValue = variable.defaultValue;
			}
		}
		try {
			localStorage.removeItem(STORAGE_KEY);
			applyUserVars({});
		} catch (error) {
			console.warn("Failed to clear saved theme:", error);
		}
	}

	function exportTheme() {
		const userVars: Record<string, string> = {};
		for (const category of themeConfig.categories) {
			for (const variable of category.variables) {
				if (variable.currentValue !== variable.defaultValue) {
					userVars[variable.name] = variable.currentValue || variable.defaultValue;
				}
			}
		}

		const cssExport = Object.entries(userVars)
			.map(([name, value]) => `${name}: ${value};`)
			.join("\n");

		const blob = new Blob([cssExport], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "theme-variables.css";
		a.click();
		URL.revokeObjectURL(url);
	}

	function importTheme(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			try {
				const lines = content.split("\n");
				const userVars: Record<string, string> = {};

				for (const line of lines) {
					const match = line.match(/^\s*(--ui-[^:]+):\s*([^;]+);?\s*$/);
					if (match) {
						const [, name, value] = match;
						userVars[name.trim()] = value.trim();
					}
				}
				for (const category of themeConfig.categories) {
					for (const variable of category.variables) {
						if (userVars[variable.name]) {
							variable.currentValue = userVars[variable.name];
						}
					}
				}

				saveUserTheme();
			} catch (error) {
				console.error("Failed to import theme:", error);
			}
		};
		reader.readAsText(file);
		input.value = "";
	}
	const filteredCategories = $derived(
		themeConfig.categories.filter((category) => {
			if (!searchQuery.trim()) return true;

			const query = searchQuery.toLowerCase();
			return (
				category.name.toLowerCase().includes(query) ||
				category.label.toLowerCase().includes(query) ||
				category.variables.some(
					(v) => v.name.toLowerCase().includes(query) || v.label.toLowerCase().includes(query),
				)
			);
		}),
	);

	const totalVariables = $derived(
		themeConfig.categories.reduce((sum, cat) => sum + cat.variables.length, 0),
	);

	const modifiedVariables = $derived(
		themeConfig.categories.reduce((sum, cat) => {
			const modified = cat.variables.filter((v) => {
				const isModified = v.currentValue !== v.defaultValue;
				if (isModified) {
					console.log(`Modified variable: ${v.name}`, {
						current: v.currentValue,
						default: v.defaultValue,
						currentType: typeof v.currentValue,
						defaultType: typeof v.defaultValue,
					});
				}
				return isModified;
			});
			return sum + modified.length;
		}, 0),
	);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold">{m.text_theme_editor_title()}</h2>
				<p class="text-muted-foreground text-sm">
					{m.text_theme_editor_description()}
				</p>
			</div>
			<div class="flex items-center gap-2">
				<Badge variant="secondary">
					{m.text_theme_editor_variables_count({ count: totalVariables.toString() })}
				</Badge>
				{#if modifiedVariables > 0}
					<Badge variant="default">
						{m.text_theme_editor_modified_count({ count: modifiedVariables.toString() })}
					</Badge>
				{/if}
			</div>
		</div>

		<!-- Actions -->
		<div class="flex flex-wrap items-center gap-2">
			<Button onclick={resetAllToDefaults} variant="outline" size="sm">
				<RotateCcw class="mr-2 h-4 w-4" />
				{m.text_button_theme_editor_reset_all()}
			</Button>
			<Button onclick={exportTheme} variant="outline" size="sm">
				<Download class="mr-2 h-4 w-4" />
				{m.text_button_theme_editor_export()}
			</Button>
			<label class="inline-flex">
				<Button variant="outline" size="sm" class="cursor-pointer">
					<Upload class="mr-2 h-4 w-4" />
					{m.text_button_theme_editor_import()}
				</Button>
				<input type="file" accept=".css,.txt" onchange={importTheme} class="sr-only" />
			</label>
		</div>

		<!-- Search -->
		<div class="relative">
			<Search
				class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform"
			/>
			<Input
				bind:value={searchQuery}
				placeholder={m.placeholder_input_theme_editor_search()}
				class="pl-10"
			/>
		</div>
	</div>

	<!-- Loading state -->
	{#if isLoading}
		<div class="flex items-center justify-center py-12">
			<div class="text-muted-foreground text-sm">{m.text_theme_editor_loading()}</div>
		</div>
	{/if}

	<!-- Error state -->
	{#if loadError}
		<Alert.Root variant="destructive">
			<Info class="h-4 w-4" />
			<Alert.Title>{m.text_theme_editor_load_error()}</Alert.Title>
			<Alert.Description>{loadError}</Alert.Description>
		</Alert.Root>
	{/if}

	<!-- Theme editor -->
	{#if !isLoading && !loadError && filteredCategories.length > 0}
		<Accordion.Root type="multiple" class="space-y-2">
			{#each filteredCategories as category (category.name)}
				<CategoryPanel {category} onVariableChange={handleVariableChange} />
			{/each}
		</Accordion.Root>
	{/if}

	<!-- Empty state -->
	{#if !isLoading && !loadError && filteredCategories.length === 0 && searchQuery}
		<div class="text-muted-foreground py-12 text-center">
			<Search class="mx-auto mb-4 h-12 w-12 opacity-50" />
			<p>{m.text_theme_editor_no_results({ query: searchQuery })}</p>
		</div>
	{/if}

	<!-- Help text -->
	<div class="text-muted-foreground space-y-1 border-t pt-4 text-xs">
		<p><strong>Tip:</strong> {m.text_theme_editor_tip()}</p>
		<p>{m.text_theme_editor_help()}</p>
	</div>
</div>
