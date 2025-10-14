<script lang="ts">
	import { appInfo } from "$lib/app-info";
	import { SettingInfoItem, SettingSwitchItem } from "$lib/components/buss/settings";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";

	function handleCheckUpdate() {
		console.log("Checking for updates...");
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.version_update()}</Label>
	<SettingSwitchItem
		label={m.auto_update()}
		checked={generalSettings.autoUpdate}
		onCheckedChange={(v) => generalSettings.setAutoUpdate(v)}
	/>
	{#snippet updateButton()}
		<Button size="sm" onclick={handleCheckUpdate}>{m.check_update()}</Button>
	{/snippet}

	<SettingInfoItem label={m.version_information()} value={appInfo.version} action={updateButton} />
</div>
