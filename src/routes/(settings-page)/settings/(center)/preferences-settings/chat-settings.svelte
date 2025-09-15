<script lang="ts">
	import { SettingSwitchItem } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";

	let autoHideCode = $state(false);
	let autoHideReason = $state(false);
	let autoCollapseThink = $state(false);
	let autoDisableMarkdown = $state(false);
</script>

<div class="flex flex-col gap-settings-gap">
	<Label class="text-label-fg">{m.settings_chatSetting()}</Label>
	<SettingSwitchItem label={m.settings_hideCode()} bind:checked={autoHideCode} />
	<SettingSwitchItem label={m.settings_hideReason()} bind:checked={autoHideReason} />
	<SettingSwitchItem label={m.settings_collapseThink()} bind:checked={autoCollapseThink} />
	<SettingSwitchItem label={m.settings_disableMarkdown()} bind:checked={autoDisableMarkdown} />
</div>
