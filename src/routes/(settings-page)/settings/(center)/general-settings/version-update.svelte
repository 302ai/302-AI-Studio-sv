<script lang="ts">
	import { SettingInfoItem, SettingSwitchItem } from "$lib/components/buss/settings";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	let autoInherit = $state(false);

	function handleCheckUpdate() {
		console.log("Checking for updates...");
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.version_update()}</Label>
	<SettingSwitchItem label={m.auto_update()} bind:checked={autoInherit} />
	{#snippet updateButton()}
		<Button size="sm" onclick={handleCheckUpdate}>{m.check_update()}</Button>
	{/snippet}

	<SettingInfoItem label={m.version_information()} value="25.35.4" action={updateButton} />
</div>
