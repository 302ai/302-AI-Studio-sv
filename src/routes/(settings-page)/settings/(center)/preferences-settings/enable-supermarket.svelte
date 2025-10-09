<script lang="ts">
	import { SettingSwitchItem } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_displayAppStore()}</Label>
	<SettingSwitchItem
		label={m.settings_DisplayAppStoreEnable()}
		checked={preferencesSettings.enableSupermarket}
		onCheckedChange={(v) => preferencesSettings.setEnableSupermarket(v)}
	/>
</div>
