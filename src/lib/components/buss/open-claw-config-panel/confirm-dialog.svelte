<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { m } from "$lib/paraglide/messages";
	import { LoaderCircle } from "@lucide/svelte";
	let {
		confirmDialogOpen = $bindable(false),
		applyConfigLoading = $bindable(false),
		handleLocalConfirmDialogOk = undefined,
		handleCloudConfirmDialogOk = undefined,
	}: {
		confirmDialogOpen: boolean;
		applyConfigLoading: boolean;
		handleLocalConfirmDialogOk?: () => void;
		handleCloudConfirmDialogOk?: () => void;
	} = $props();
</script>

<AlertDialog.Root bind:open={confirmDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.open_claw_update_config()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.open_claw_update_config_dialog_description()}
			</AlertDialog.Description>
		</AlertDialog.Header>

		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			{#if handleLocalConfirmDialogOk}
				<AlertDialog.Action
					onclick={handleLocalConfirmDialogOk}
					disabled={applyConfigLoading}
				>
					{#if applyConfigLoading}
						<LoaderCircle class="h-4 w-4 animate-spin" />
					{/if}
					{m.open_claw_update()}{m.title_local()}
				</AlertDialog.Action>
			{/if}
			{#if handleLocalConfirmDialogOk}
				<AlertDialog.Action
					onclick={handleCloudConfirmDialogOk}
					disabled={applyConfigLoading}
				>
					{#if applyConfigLoading}
						<LoaderCircle class="h-4 w-4 animate-spin" />
					{/if}
					{m.open_claw_update()}{m.cloud_mode_instance()}
				</AlertDialog.Action>
			{/if}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
