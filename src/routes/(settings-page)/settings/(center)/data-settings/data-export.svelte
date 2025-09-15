<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { Download } from "@lucide/svelte";

	function handleExport() {
		console.log("Exporting data...");
	}
</script>

{#snippet exportButton()}
	<Button size="sm" onclick={handleExport}>
		<Download className="size-4" />
		{m.settings_exportLabel()}
	</Button>
{/snippet}

<div class="flex flex-col gap-settings-gap">
	<Label class="text-label-fg">{m.settings_exportData()}</Label>
	<SettingInfoItem label={m.settings_exportAsJson()} action={exportButton} />
</div>
