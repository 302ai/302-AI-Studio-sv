<script lang="ts">
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import { Download } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	let isExporting = $state(false);

	async function handleExport() {
		try {
			isExporting = true;
			const filePath = await window.electronAPI.dataService.exportStorage();

			if (filePath) {
				toast.success(m.settings_exportSuccess(), {
					description: filePath,
				});
			}
		} catch (error) {
			console.error("Failed to export data:", error);
			toast.error(m.settings_exportFailed(), {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			isExporting = false;
		}
	}
</script>

{#snippet exportButton()}
	<Button size="sm" onclick={handleExport} disabled={isExporting}>
		<Download className="size-4" />
		{isExporting ? m.settings_exporting() : m.settings_exportLabel()}
	</Button>
{/snippet}

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_exportData()}</Label>
	<SettingInfoItem label={m.settings_exportAsJson()} action={exportButton} />
</div>
