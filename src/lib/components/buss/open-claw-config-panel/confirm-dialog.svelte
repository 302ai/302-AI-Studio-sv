<script lang="ts">
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { m } from "$lib/paraglide/messages";
	import { LoaderCircle } from "@lucide/svelte";
	let {
		confirmDialogOpen = $bindable(false),
		handleLocalConfirmDialogOk = undefined,
		handleCloudConfirmDialogOk = undefined,
	}: {
		confirmDialogOpen: boolean;
		handleLocalConfirmDialogOk?: () => Promise<void>;
		handleCloudConfirmDialogOk?: () => Promise<void>;
	} = $props();

	let loading = $state({
		localLoading: false,
		cloudLoading: false,
	});

	const commandFn = async (l: keyof typeof loading, command: () => Promise<void>) => {
		loading[l] = true;
		try {
			await command();
		} finally {
			loading[l] = false;
		}
	};
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
					onclick={() => commandFn("localLoading", handleLocalConfirmDialogOk)}
					disabled={loading.localLoading}
				>
					{#if loading.localLoading}
						<LoaderCircle class="h-4 w-4 animate-spin" />
					{/if}
					{m.open_claw_update()}{m.title_local()}
				</AlertDialog.Action>
			{/if}
			{#if handleCloudConfirmDialogOk}
				<AlertDialog.Action
					onclick={() => commandFn("cloudLoading", handleCloudConfirmDialogOk)}
					disabled={loading.cloudLoading}
				>
					{#if loading.cloudLoading}
						<LoaderCircle class="h-4 w-4 animate-spin" />
					{/if}
					{m.open_claw_update()}{m.cloud_mode_instance()}
				</AlertDialog.Action>
			{/if}
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
