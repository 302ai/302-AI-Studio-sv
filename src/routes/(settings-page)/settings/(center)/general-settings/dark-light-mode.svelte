<script lang="ts">
	import { SegButton } from "$lib/components/buss/settings";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages";
	import { Laptop, Moon, Sun } from "@lucide/svelte";
	import type { Theme } from "@shared/types";
	import { setTheme, persistedThemeState } from "$lib/stores/theme.state.svelte";

	let selectedKey = $derived(persistedThemeState.current.theme);

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
		setTheme(key as Theme);
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_theme()}</Label>
	<SegButton options={themeOptions} {selectedKey} onSelect={handleSelect} />
</div>
