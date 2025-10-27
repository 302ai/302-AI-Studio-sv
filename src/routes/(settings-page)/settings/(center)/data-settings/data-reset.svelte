<script lang="ts">
	import SettingInfoItem from "$lib/components/buss/settings/setting-info-item.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import { Trash2 } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	let isResetting = $state(false);
	let open = $state(false);

	function onOpenChange(value: boolean) {
		open = value;
	}

	function showResetDialog() {
		open = true;
	}

	async function handleReset() {
		try {
			isResetting = true;
			open = false;
			await window.electronAPI.appService.resetAllData();
		} catch (error) {
			console.error("Failed to reset data:", error);
			toast.error(m.settings_resetFailed(), {
				description: error instanceof Error ? error.message : String(error),
			});
			isResetting = false;
		}
	}
</script>

{#snippet resetButton()}
	<Button size="sm" variant="destructive" onclick={showResetDialog} disabled={isResetting}>
		<Trash2 className="size-4" />
		{isResetting ? m.settings_resetting() : m.settings_resetLabel()}
	</Button>
{/snippet}

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_resetData()}</Label>
	<SettingInfoItem label={m.settings_resetAllData()} action={resetButton} />

	<Dialog.Root {open} {onOpenChange}>
		<Dialog.Content>
			<Dialog.Header>
				<Dialog.Title>{m.settings_resetData()}</Dialog.Title>
			</Dialog.Header>

			<p class="text-sm font-normal">{m.settings_resetWarning()}</p>
			<p class="text-destructive text-sm">{m.settings_resetWarningDetail()}</p>

			<Dialog.Footer>
				<Button
					onclick={() => {
						open = false;
					}}
					class="border-border text-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring dark:border-border dark:text-foreground dark:hover:bg-muted dark:hover:text-foreground border bg-transparent focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
					variant="outline">{m.common_cancel()}</Button
				>
				<Button variant="destructive" onclick={handleReset}>{m.settings_resetConfirm()}</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
