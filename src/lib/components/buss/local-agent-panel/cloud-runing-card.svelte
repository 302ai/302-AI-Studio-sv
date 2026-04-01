<script lang="ts">
	/**
	 *Description: Cloud Run Status Panel
	 *Assisted: Qwen3.6 Plus
	 *Author: Leessmin
	 *Date: 2026-04-01
	 **/

	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";

	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { cloudEnvState } from "$lib/stores/code-agent/cloud-env-state.svelte";

	function handleActivate() {
		// TODO: Navigate to settings-vibe-platform-cloud page when it's ready
		console.log(
			"[CloudRunningCard] navigate to settings-vibe-platform-cloud: not implemented yet",
		);
	}

	async function handleStart() {
		await cloudEnvState.startCloud();
	}

	async function handleStop() {
		await cloudEnvState.stopCloud();
	}
</script>

<div class="flex items-start justify-between gap-4">
	<div class="flex-1 space-y-2">
		<div class="flex items-center gap-3">
			<Label class="text-muted-foreground min-w-18 font-normal"
				>{m.cloud_mode_activation_status()}</Label
			>
			<StatusIndicator
				status={cloudEnvState.activated ? "green" : "gray"}
				text={cloudEnvState.activated
					? m.cloud_mode_activated()
					: m.cloud_mode_not_activated()}
			/>
		</div>
		<div class="flex items-center gap-3">
			<Label class="text-muted-foreground min-w-18 font-normal"
				>{m.cloud_mode_startup_status()}</Label
			>
			<StatusIndicator
				status={cloudEnvState.running ? "green" : "gray"}
				text={cloudEnvState.running ? m.cloud_mode_started() : m.cloud_mode_not_started()}
			/>
		</div>
		<div class="flex items-center gap-3">
			<Label class="text-muted-foreground min-w-18 font-normal"
				>{m.cloud_mode_health_status()}</Label
			>
			<StatusIndicator
				status={cloudEnvState.healthStatus === "healthy" ? "green" : "gray"}
				text={cloudEnvState.healthStatus === "healthy"
					? m.cloud_mode_healthy()
					: m.cloud_mode_unknown()}
			/>
		</div>
		<div class="flex items-center gap-3">
			<Label class="text-muted-foreground min-w-18 font-normal"
				>{m.cloud_mode_openclaw_status()}</Label
			>
			<StatusIndicator
				status={cloudEnvState.openClawStatus === "healthy" ? "green" : "gray"}
				text={cloudEnvState.openClawStatus === "healthy"
					? m.cloud_mode_running()
					: m.cloud_mode_unknown()}
			/>
		</div>
	</div>
	{#if !cloudEnvState.activated}
		<Button size="sm" onclick={handleActivate}>
			{m.cloud_mode_activate_button()}
		</Button>
	{:else if cloudEnvState.running}
		<Button
			size="sm"
			variant="destructive"
			disabled={cloudEnvState.starting}
			onclick={handleStop}
		>
			{m.cloud_mode_not_started()}
		</Button>
	{:else}
		<Button size="sm" disabled={cloudEnvState.starting} onclick={handleStart}>
			{m.cloud_mode_started()}
		</Button>
	{/if}
</div>
