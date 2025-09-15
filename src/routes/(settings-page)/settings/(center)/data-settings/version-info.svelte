<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
</script>

<div class="flex flex-col gap-settings-gap">
	<Label class="text-label-fg">{m.version_information()}</Label>
	<SettingInfoItem label={m.settings_currentVersion()} value="25.35.4" />
</div>
