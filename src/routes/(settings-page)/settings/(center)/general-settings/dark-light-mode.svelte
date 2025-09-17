<script lang="ts">
	import { SegButton } from "$lib/components/buss/settings";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages";
	import { Laptop, Moon, Sun } from "@lucide/svelte";
	import { setMode } from "mode-watcher";
	import { onMount } from "svelte";
	import type { Theme } from "@shared/types";

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
		if (window.electronAPI) {
			window.electronAPI.theme.setTheme(key as Theme);
		}
	}

	onMount(() => {
		// Listen for theme changes from electron
		if (window.electronAPI) {
			window.electronAPI.theme.onThemeChange((theme: Theme) => {
				selectedKey = theme;
				setMode(theme);
			});
		}
	});
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_theme()}</Label>
	<SegButton options={themeOptions} {selectedKey} onSelect={handleSelect} />
</div>
