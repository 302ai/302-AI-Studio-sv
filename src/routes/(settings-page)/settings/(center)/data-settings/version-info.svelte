<script lang="ts">
	import { appInfo } from "$lib/app-info";
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages.js";
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.version_information()}</Label>
	<SettingInfoItem label={m.settings_currentVersion()} value={appInfo.version} />
</div>
