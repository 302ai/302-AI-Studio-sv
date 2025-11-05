<script lang="ts">
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import { Trash2 } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	let isResetting = $state(false);
	let isClearingHistory = $state(false);
	let openResetDialog = $state(false);
	let openClearHistoryDialog = $state(false);

	function onResetDialogChange(value: boolean) {
		openResetDialog = value;
	}

	function onClearHistoryDialogChange(value: boolean) {
		openClearHistoryDialog = value;
	}

	function showResetDialog() {
		openResetDialog = true;
	}

	function showClearHistoryDialog() {
		openClearHistoryDialog = true;
	}

	async function handleReset() {
		try {
			isResetting = true;
			openResetDialog = false;
			await window.electronAPI.appService.resetAllData();
		} catch (error) {
			console.error("Failed to reset data:", error);
			toast.error(m.settings_resetFailed(), {
				description: error instanceof Error ? error.message : String(error),
			});
			isResetting = false;
		}
	}

	async function handleClearHistory() {
		try {
			isClearingHistory = true;
			openClearHistoryDialog = false;
			await window.electronAPI.appService.clearChatHistory();
		} catch (error) {
			console.error("Failed to clear chat history:", error);
			toast.error(m.settings_clearChatHistoryFailed(), {
				description: error instanceof Error ? error.message : String(error),
			});
			isClearingHistory = false;
		}
	}
</script>

{#snippet clearHistoryButton()}
	<Button
		size="sm"
		variant="destructive"
		onclick={showClearHistoryDialog}
		disabled={isClearingHistory}
	>
		<Trash2 className="size-4" />
		{isClearingHistory ? m.settings_clearingChatHistory() : m.settings_clearChatHistoryLabel()}
	</Button>
{/snippet}

{#snippet resetButton()}
	<Button size="sm" variant="destructive" onclick={showResetDialog} disabled={isResetting}>
		<Trash2 className="size-4" />
		{isResetting ? m.settings_resetting() : m.settings_resetLabel()}
	</Button>
{/snippet}

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_resetData()}</Label>
	<SettingInfoItem label={m.settings_clearChatHistory()} action={clearHistoryButton} />
	<SettingInfoItem label={m.settings_resetAllData()} action={resetButton} />

	<!-- Clear Chat History Dialog -->
	<Dialog.Root open={openClearHistoryDialog} onOpenChange={onClearHistoryDialogChange}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{m.settings_clearChatHistory()}</Dialog.Title>
			</Dialog.Header>

			<p class="text-sm font-normal">{m.settings_clearChatHistoryWarning()}</p>
			<p class="text-destructive text-sm">{m.settings_clearChatHistoryWarningDetail()}</p>

			<Dialog.Footer>
				<Button
					onclick={() => {
						openClearHistoryDialog = false;
					}}
					class="border-border text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring dark:border-border dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground border bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
					variant="outline">{m.common_cancel()}</Button
				>
				<Button variant="destructive" onclick={handleClearHistory}
					>{m.settings_clearChatHistoryConfirm()}</Button
				>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Reset All Data Dialog -->
	<Dialog.Root open={openResetDialog} onOpenChange={onResetDialogChange}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{m.settings_resetData()}</Dialog.Title>
			</Dialog.Header>

			<p class="text-sm font-normal">{m.settings_resetWarning()}</p>
			<p class="text-destructive text-sm">{m.settings_resetWarningDetail()}</p>

			<Dialog.Footer>
				<Button
					onclick={() => {
						openResetDialog = false;
					}}
					class="border-border text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring dark:border-border dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground border bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
					variant="outline">{m.common_cancel()}</Button
				>
				<Button variant="destructive" onclick={handleReset}>{m.settings_resetConfirm()}</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
