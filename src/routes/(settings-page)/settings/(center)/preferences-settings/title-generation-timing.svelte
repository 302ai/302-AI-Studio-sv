<script lang="ts">
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";

	const searchServices = [
		{ label: m.settings_firstTime(), value: "firstTime" },
		{ label: m.settings_everyConversation(), value: "everyTime" },
		{ label: m.settings_off(), value: "off" },
	];

	let value = $state("firstTime");
</script>

<div class="flex flex-col gap-settings-gap">
	<Label class="text-label-fg">{m.settings_titleGenerationTiming()}</Label>
	<SettingSelect name="titleGenerationTiming" bind:value options={searchServices} />
</div>
