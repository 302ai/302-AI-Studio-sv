<script lang="ts">
	import { SettingSwitchItem } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";

	let autoParseUrl = $state(false);
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_parseUrl()}</Label>
	<SettingSwitchItem label={m.settings_ParseUrlDesc()} bind:checked={autoParseUrl} />
</div>
