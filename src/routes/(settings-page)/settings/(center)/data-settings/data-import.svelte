<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { Upload } from "@lucide/svelte";

	function handleImport() {
		console.log("Importing data...");
	}
</script>

{#snippet importButton()}
	<Button
		size="sm"
		onclick={handleImport}
		variant="outline"
		class="border border-border bg-transparent text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none dark:border-border dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground"
	>
		<Upload className="size-4" />
		{m.settings_importLabel()}
	</Button>
{/snippet}

<div class="flex flex-col gap-settings-gap">
	<Label class="text-label-fg">{m.settings_importData()}</Label>
	<SettingInfoItem label={m.settings_importFromBackup()} action={importButton} />
</div>
