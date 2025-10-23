<script lang="ts">
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import { Upload } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	async function handleImport() {
		try {
			const { dataService } = window.electronAPI;
			const result = await dataService.importStorage();

			if (result.success) {
				// Show success message
				toast.success(result.message, {
					description: m.settings_importSuccess({
						count: result.importedFiles || 0,
					}),
					duration: 3000,
				});

				// Auto restart app after 2 seconds
				setTimeout(() => {
					toast.info(m.settings_restartingApp(), {
						duration: 2000,
					});

					// Restart the entire Electron app
					setTimeout(() => {
						window.electronAPI.appService.restartApp();
						// window.location.reload();
					}, 1000);
				}, 1500);
			} else {
				console.log("取消导入");
			}
		} catch (error) {
			console.error("Import error:", error);
			toast.error(m.settings_importFailed(), {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	async function handleLegacyImport() {
		try {
			const { dataService } = window.electronAPI;
			const result = await dataService.importLegacyJson();

			if (result.success) {
				toast.success(result.message, {
					description: m.settings_importSuccess({
						count: result.importedFiles || 0,
					}),
					duration: 3000,
				});

				setTimeout(() => {
					toast.info(m.settings_restartingApp(), {
						duration: 2000,
					});

					// Restart the entire Electron app
					setTimeout(() => {
						window.electronAPI.appService.restartApp();
					}, 1000);
				}, 1500);
			} else {
				console.log("取消导入");
			}
		} catch (error) {
			console.error("Legacy import error:", error);
			toast.error(m.settings_importFailed(), {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}
</script>

{#snippet importButton()}
	<Button
		size="sm"
		onclick={handleImport}
		variant="outline"
		class="border-border text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring dark:border-border dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground border bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
	>
		<Upload className="size-4" />
		{m.settings_importLabel()}
	</Button>
{/snippet}

{#snippet legacyImportButton()}
	<Button
		size="sm"
		onclick={handleLegacyImport}
		variant="outline"
		class="border-border text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring dark:border-border dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground border bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
	>
		<Upload className="size-4" />
		{m.settings_importLabel()}
	</Button>
{/snippet}

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_importData()}</Label>
	<SettingInfoItem label={m.settings_importFromBackup()} action={importButton} />
	<SettingInfoItem label={m.settings_importLegacyJson()} action={legacyImportButton} />
</div>
