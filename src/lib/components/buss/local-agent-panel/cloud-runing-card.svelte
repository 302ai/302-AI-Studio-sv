<script lang="ts">
	/**
	 *Description: Cloud Run Status Panel
	 *Assisted: Qwen3.6 Plus
	 *Author: Leessmin
	 *Date: 2026-04-01
	 **/

	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";

	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { m } from "$lib/paraglide/messages";
	import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { RefreshCw } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { cn } from "tailwind-variants";
	import { ButtonWithTooltip } from "../button-with-tooltip";

	let { state: _state, openClaw, loading, healthProps } = $derived(cloudModeState.init());

	let confirmDialogOpen = $state(false);

	function handleRestartClick() {
		confirmDialogOpen = true;
	}

	async function handleRestartConfirm() {
		try {
			await cloudModeState.restartMachine();
			confirmDialogOpen = false;
		} catch (e) {
			toast.error(m.cloud_mode_instance_restart_failed() + e);
		}
	}

	function resolveOpenClawStatus(v: boolean | null): "green" | "red" | "gray" {
		return v == null ? "gray" : v ? "green" : "red";
	}

	function resolveOpenClawText(v: boolean | null): string {
		return v == null
			? m.cloud_mode_unknown()
			: v
				? m.cloud_mode_healthy()
				: m.cloud_mode_unhealthy();
	}

	function handleActivate() {
		window.electronAPI.windowService.handleOpenSettingsWindow(
			"/settings/agent-settings/openclaw?platform=cloud",
		);
	}
</script>

{#if loading.init}
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-2">
			<div class="flex items-center gap-3">
				<Skeleton class="h-4 w-18" />
				<Skeleton class="h-4 w-20" />
				<Skeleton class="size-8 rounded-md" />
			</div>
			<div class="flex items-center gap-3">
				<Skeleton class="h-4 w-18" />
				<Skeleton class="h-4 w-20" />
			</div>
			<div class="flex items-center gap-3">
				<Skeleton class="h-4 w-18" />
				<Skeleton class="h-4 w-20" />
			</div>
		</div>
	</div>
{:else}
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-2">
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-18 font-normal"
					>{m.agent_settings_instance_status()}</Label
				>
				<StatusIndicator
					status={healthProps.status}
					text={healthProps.text}
					warningTooltip={m.cloud_mode_unhealthy()}
				/>
				<ButtonWithTooltip
					onclick={handleRestartClick}
					tooltip={m.cloud_mode_reboot_instance()}
					class="hover:!bg-icon-btn-hover size-8"
				>
					<RefreshCw class={cn("h-4 w-4", loading.restart && "animate-spin")} />
				</ButtonWithTooltip>
			</div>
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-18 font-normal"
					>{m.cloud_mode_openclaw_status()}</Label
				>
				<StatusIndicator
					status={resolveOpenClawStatus(openClaw.status)}
					text={resolveOpenClawText(openClaw.status)}
					warningTooltip={m.cloud_mode_unhealthy()}
				/>
			</div>
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-18 font-normal">接口状态</Label>
				<StatusIndicator
					status={resolveOpenClawStatus(openClaw.api_status)}
					text={resolveOpenClawText(openClaw.api_status)}
					warningTooltip={m.cloud_mode_unhealthy()}
				/>
			</div>
		</div>
		{#if _state.instanceName === ""}
			<Button size="sm" onclick={handleActivate}>
				{m.cloud_mode_activate_button()}
			</Button>
		{:else if _state.expired}
			<Button size="sm" onclick={handleActivate}>
				{m.cloud_mode_renew_button()}
			</Button>
		{/if}
	</div>
{/if}

<AlertDialog.Root bind:open={confirmDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.cloud_mode_restart_machine_confirm_title()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.cloud_mode_restart_machine_confirm_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handleRestartConfirm}>
				{m.cloud_mode_confirm()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
