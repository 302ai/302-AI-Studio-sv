<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";
	import * as AlertDialog from "$lib/components/ui/alert-dialog";
	import { Label } from "$lib/components/ui/label";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { m } from "$lib/paraglide/messages";
	import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { cn } from "$lib/utils";
	import { LoaderCircle, RefreshCw } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	let { state: cloudState, openClaw, loading, healthProps } = $derived(cloudModeState.init());

	let showRestartMachineDialog = $state(false);
	let showRestartOpenClawDialog = $state(false);

	async function handleRestartMachine() {
		try {
			await cloudModeState.restartMachine();
			showRestartMachineDialog = false;
		} catch (e) {
			toast.error(m.cloud_mode_instance_restart_failed() + e);
		}
	}

	async function handleRestartOpenClaw() {
		try {
			await cloudModeState.restartOpenClaw();
			showRestartOpenClawDialog = false;
		} catch (e) {
			toast.error(m.cloud_mode_openclaw_restart_failed() + e);
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
</script>

{#if loading.init}
	<Skeleton class="h-5 w-32" />
	<div class="rounded-lg border p-5 space-y-5">
		<div class="space-y-3">
			<div class="flex items-center gap-3">
				<Skeleton class="h-4 w-18" />
				<Skeleton class="h-4 w-20" />
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
	<Label class="text-label-fg font-normal">{m.local_platform_environment_monitoring()}</Label>
	<div class="rounded-lg border p-5 space-y-5">
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1 space-y-3">
				<div class="flex items-center gap-2 mb-2!">
					<Label class="text-muted-foreground min-w-18 font-normal"
						>{m.agent_settings_instance_status()}</Label
					>
					<StatusIndicator
						status={healthProps.status}
						text={healthProps.text}
						warningTooltip={m.cloud_mode_unhealthy()}
					/>
					<div class="relative size-5">
						{#if !cloudState.expired && cloudState.instanceName && cloudState.status == "running"}
							<ButtonWithTooltip
								onclick={() => (showRestartMachineDialog = true)}
								tooltip={m.cloud_mode_reboot_instance()}
								class="hover:!bg-icon-btn-hover size-8 absolute top-[-30%] left-0"
							>
								<RefreshCw
									class={cn("size-4", loading.restart && "animate-spin")}
								/>
							</ButtonWithTooltip>
						{/if}
					</div>
				</div>
				<div class="flex items-center gap-2 mb-2!">
					<Label class="text-muted-foreground min-w-18 font-normal"
						>{m.cloud_mode_openclaw_status()}</Label
					>
					<StatusIndicator
						status={resolveOpenClawStatus(openClaw.status)}
						text={resolveOpenClawText(openClaw.status)}
						warningTooltip={m.cloud_mode_unhealthy()}
					/>
					<div class="relative size-5">
						{#if openClaw.status == false && !cloudState.expired}
							<ButtonWithTooltip
								onclick={() => (showRestartOpenClawDialog = true)}
								tooltip={m.cloud_mode_restart_docker()}
								class="hover:!bg-icon-btn-hover size-8 absolute top-[-30%] left-0"
							>
								<RefreshCw
									class={cn("size-4", loading.restartOpenClaw && "animate-spin")}
								/>
							</ButtonWithTooltip>
						{/if}
					</div>
				</div>
				<div class="flex items-center gap-2 mb-2!">
					<Label class="text-muted-foreground min-w-18 font-normal"
						>{m.cloud_mode_api_status()}</Label
					>
					<StatusIndicator
						status={resolveOpenClawStatus(openClaw.api_status)}
						text={resolveOpenClawText(openClaw.api_status)}
						warningTooltip={m.cloud_mode_unhealthy()}
					/>
				</div>
			</div>
		</div>
	</div>
{/if}

<AlertDialog.Root bind:open={showRestartMachineDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.cloud_mode_restart_machine_confirm_title()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.cloud_mode_restart_machine_confirm_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action disabled={loading.restart} onclick={handleRestartMachine}>
				{#if loading.restart}
					<LoaderCircle class="h-4 w-4 animate-spin" />
				{/if}
				{m.cloud_mode_confirm()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root bind:open={showRestartOpenClawDialog}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.cloud_mode_restart_openclaw_confirm_title()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.cloud_mode_restart_openclaw_confirm_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{m.common_cancel()}</AlertDialog.Cancel>
			<AlertDialog.Action disabled={loading.restartOpenClaw} onclick={handleRestartOpenClaw}>
				{#if loading.restartOpenClaw}
					<LoaderCircle class="h-4 w-4 animate-spin" />
				{/if}
				{m.cloud_mode_confirm()}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
