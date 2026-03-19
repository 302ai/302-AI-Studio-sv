<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { m } from "$lib/paraglide/messages";
	import { LoaderCircle } from "@lucide/svelte";
	let {
		confirmDialogOpen = $bindable(false),
		applyConfigLoading = $bindable(false),
		handleConfirmDialogOk,
	}: {
		confirmDialogOpen: boolean;
		applyConfigLoading: boolean;
		handleConfirmDialogOk: () => void;
	} = $props();

	let open = $derived(confirmDialogOpen);
	let loading = $derived(applyConfigLoading);

	const handleDialogOk = () => {
		handleConfirmDialogOk();
	};
</script>

<AlertDialog.Root bind:open>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.open_claw_update_config()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.open_claw_update_config_dialog_description()}
			</AlertDialog.Description>
		</AlertDialog.Header>

		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleDialogOk} disabled={loading}>
				{#if loading}
					<LoaderCircle class="h-4 w-4 animate-spin" />
				{/if}
				{m.open_claw_update()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
