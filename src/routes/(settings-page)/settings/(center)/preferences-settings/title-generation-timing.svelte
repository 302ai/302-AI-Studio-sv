<script lang="ts">
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import {
		preferencesSettings,
		type TitleGenerationTiming,
	} from "$lib/stores/preferences-settings.state.svelte";

	const searchServices = [
		{ label: m.settings_firstTime(), value: "firstTime" },
		{ label: m.settings_everyConversation(), value: "everyTime" },
		{ label: m.settings_off(), value: "off" },
	];
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_titleGenerationTiming()}</Label>
	<SettingSelect
		name="titleGenerationTiming"
		value={preferencesSettings.titleGenerationTiming}
		options={searchServices}
		onValueChange={(v) => preferencesSettings.setTitleGenerationTiming(v as TitleGenerationTiming)}
	/>
</div>
