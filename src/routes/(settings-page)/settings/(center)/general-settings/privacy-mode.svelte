<script lang="ts">
	import { SettingSwitchItem } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";

	let autoInherit = $state(false);
</script>

<div class="gap-settings-gap flex flex-col">
	<Label id="privacy-mode" class="text-label-fg">{m.privacy_mode()}</Label>
	<SettingSwitchItem label={m.auto_inherit()} bind:checked={autoInherit} />
</div>
