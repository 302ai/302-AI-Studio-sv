<script lang="ts">
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import {
		preferencesSettings,
		type SearchProvider,
	} from "$lib/stores/preferences-settings.state.svelte";

	const searchServices = [
		{ label: "search1api", value: "search1api" },
		{ label: "tavily", value: "tavily" },
		{ label: "exa", value: "exa" },
		{ label: "bochaai", value: "bochaai" },
	];
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_searchProvider()}</Label>
	<SettingSelect
		name="searchProvider"
		value={preferencesSettings.searchProvider}
		options={searchServices}
		placeholder={m.select_language()}
		onValueChange={(v) => preferencesSettings.setSearchProvider(v as SearchProvider)}
	/>
</div>
