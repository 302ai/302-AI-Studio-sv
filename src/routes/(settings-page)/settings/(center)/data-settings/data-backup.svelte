<script lang="ts">
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import type { BackupInfo } from "@shared/types";
	import { Archive, FolderOpen, RotateCcw, Trash2 } from "@lucide/svelte";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	let backups = $state<BackupInfo[]>([]);
	let isLoading = $state(false);
	let restoreDialogOpen = $state(false);
	let selectedBackup = $state<BackupInfo | null>(null);

	onMount(async () => {
		await loadBackups();
	});

	async function loadBackups() {
		try {
			isLoading = true;
			const data = await window.electronAPI.dataService.listBackups();
			backups = data;
		} catch (error) {
			console.error("Failed to load backups:", error);
			toast.error(m.settings_backupLoadFailed(), {
				description: error instanceof Error ? error.message : String(error),
			});
		} finally {
			isLoading = false;
		}
	}

	async function handleOpenBackupDirectory() {
		try {
			await window.electronAPI.dataService.openBackupDirectory();
		} catch (error) {
			console.error("Failed to open backup directory:", error);
			toast.error(m.settings_backupOpenFailed(), {
				description: error instanceof Error ? error.message : String(error),
			});
		}
	}

	function confirmRestore(backup: BackupInfo) {
		selectedBackup = backup;
		restoreDialogOpen = true;
	}

	async function handleRestore() {
		if (!selectedBackup) return;

		try {
			restoreDialogOpen = false;
			toast.info(m.settings_backupRestoring());

			const result = await window.electronAPI.dataService.restoreFromBackup(selectedBackup.path);

			if (result.success) {
				toast.success(result.message, {
					duration: 3000,
				});

				setTimeout(() => {
					toast.info(m.settings_restartingApp(), {
						duration: 2000,
					});

					setTimeout(() => {
						window.electronAPI.appService.restartApp();
					}, 1000);
				}, 1500);
			} else {
				toast.error(result.message);
			}
		} catch (error) {
			console.error("Failed to restore backup:", error);
			toast.error(m.settings_backupRestoreFailed(), {
				description: error instanceof Error ? error.message : String(error),
			});
		}
	}

	async function handleDeleteBackup(backup: BackupInfo) {
		try {
			const success = await window.electronAPI.dataService.deleteBackup(backup.path);

			if (success) {
				toast.success(m.settings_backupDeleteSuccess());
				await loadBackups();
			} else {
				toast.error(m.settings_backupDeleteFailed());
			}
		} catch (error) {
			console.error("Failed to delete backup:", error);
			toast.error(m.settings_backupDeleteFailed(), {
				description: error instanceof Error ? error.message : String(error),
			});
		}
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleString();
	}
</script>

{#snippet openDirectoryButton()}
	<Button size="sm" variant="outline" onclick={handleOpenBackupDirectory}>
		<FolderOpen className="size-4" />
		{m.settings_backupOpenDirectory()}
	</Button>
{/snippet}

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_backupManagement()}</Label>
	<SettingInfoItem label={m.settings_backupInfo()} action={openDirectoryButton} />

	{#if isLoading}
		<div class="text-muted-foreground p-4 text-center text-sm">
			{m.settings_backupLoading()}
		</div>
	{:else if backups.length === 0}
		<div class="text-muted-foreground p-4 text-center text-sm">
			{m.settings_backupEmpty()}
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			{#each backups as backup (backup.path)}
				<div
					class="border-border bg-card hover:bg-muted/50 flex items-center justify-between rounded-md border p-3 transition-colors"
				>
					<div class="flex items-center gap-3">
						<Archive class="text-muted-foreground size-5 shrink-0" />
						<div class="flex flex-col gap-1">
							<div class="text-sm font-medium">
								{formatDate(backup.timestamp)}
							</div>
							<div class="text-muted-foreground text-xs">
								{formatBytes(backup.size)}
							</div>
						</div>
					</div>
					<div class="flex gap-2">
						<Button size="sm" variant="outline" onclick={() => confirmRestore(backup)}>
							<RotateCcw className="size-4" />
							{m.settings_backupRestore()}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onclick={() => handleDeleteBackup(backup)}
							class="text-destructive hover:text-destructive"
						>
							<Trash2 className="size-4" />
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<Dialog.Root open={restoreDialogOpen} onOpenChange={(open) => (restoreDialogOpen = open)}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{m.settings_backupRestoreTitle()}</Dialog.Title>
			</Dialog.Header>

			<p class="text-sm font-normal">{m.settings_backupRestoreWarning()}</p>
			{#if selectedBackup}
				<div class="bg-muted rounded-md p-3">
					<div class="text-sm font-medium">{formatDate(selectedBackup.timestamp)}</div>
					<div class="text-muted-foreground text-xs">{formatBytes(selectedBackup.size)}</div>
				</div>
			{/if}

			<Dialog.Footer>
				<Button
					onclick={() => {
						restoreDialogOpen = false;
					}}
					class="border-border text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring dark:border-border dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground border bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
					variant="outline">{m.common_cancel()}</Button
				>
				<Button onclick={handleRestore}>{m.settings_backupRestoreConfirm()}</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
