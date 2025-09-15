<script lang="ts">
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";

	const searchServices = [
		{ label: "search1api", value: "search1api" },
		{ label: "tavily", value: "tavily" },
		{ label: "exa", value: "exa" },
		{ label: "bochaai", value: "bochaai" },
	];

	let value = $state("search1api");
</script>

<div class="flex flex-col gap-settings-gap">
	<Label class="text-label-fg">{m.settings_searchProvider()}</Label>
	<SettingSelect
		name="searchProvider"
		bind:value
		options={searchServices}
		placeholder={m.select_language()}
	/>
</div>
