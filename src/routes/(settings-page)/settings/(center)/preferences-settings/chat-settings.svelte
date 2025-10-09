<script lang="ts">
	import { SettingSwitchItem } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_chatSetting()}</Label>
	<SettingSwitchItem
		label={m.settings_hideCode()}
		checked={preferencesSettings.autoHideCode}
		onCheckedChange={(v) => preferencesSettings.setAutoHideCode(v)}
	/>
	<SettingSwitchItem
		label={m.settings_hideReason()}
		checked={preferencesSettings.autoHideReason}
		onCheckedChange={(v) => preferencesSettings.setAutoHideReason(v)}
	/>
	<SettingSwitchItem
		label={m.settings_collapseThink()}
		checked={preferencesSettings.autoCollapseThink}
		onCheckedChange={(v) => preferencesSettings.setAutoCollapseThink(v)}
	/>
	<SettingSwitchItem
		label={m.settings_disableMarkdown()}
		checked={preferencesSettings.autoDisableMarkdown}
		onCheckedChange={(v) => preferencesSettings.setAutoDisableMarkdown(v)}
	/>
</div>
