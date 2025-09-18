<script lang="ts">
	import { SegButton } from "$lib/components/buss/settings";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages";
	import { Laptop, Moon, Sun } from "@lucide/svelte";
	import { setMode } from "mode-watcher";
	import { onMount } from "svelte";
	import type { Theme } from "@shared/types";

	const { app } = window.electronAPI;

	let selectedKey = "system";
	const themeOptions = [
		{
			key: "light",
			icon: Sun,
			label: m.settings_lightMode(),
			iconSize: 16,
		},
		{
			key: "dark",
			icon: Moon,
			label: m.settings_darkMode(),
			iconSize: 16,
		},
		{
			key: "system",
			icon: Laptop,
			label: m.settings_systemMode(),
			iconSize: 16,
		},
	];

	async function handleSelect(key: string) {
		selectedKey = key;
		setMode(key as "light" | "dark" | "system");

		// Send theme change to electron main process
		if (app) {
			await app.setTheme(key as Theme);
		}
	}

	onMount(async () => {
		// Get current theme from electron
		if (app) {
			try {
				const currentTheme = await app.getCurrentTheme();
				selectedKey = currentTheme;
				setMode(currentTheme);
			} catch (error) {
				console.warn("Failed to get current theme:", error);
			}
		}
	});
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_theme()}</Label>
	<SegButton options={themeOptions} {selectedKey} onSelect={handleSelect} />
</div>
