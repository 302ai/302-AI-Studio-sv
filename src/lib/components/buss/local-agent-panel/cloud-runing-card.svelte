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
	import {
		cloudEnvState,
		type CloudHealthStatus,
	} from "$lib/stores/code-agent/cloud-env-state.svelte";

	type StatusProps = { status: "green" | "red" | "gray"; text: string };

	function getHealthProps(s: CloudHealthStatus): StatusProps {
		switch (s) {
			case "healthy":
				return { status: "green", text: m.cloud_mode_healthy() };
			case "unhealthy":
				return { status: "red", text: m.cloud_mode_unhealthy() };
			default:
				return { status: "gray", text: m.cloud_mode_unknown() };
		}
	}

	function handleActivate() {
		window.electronAPI.windowService.handleOpenSettingsWindow(
			"/settings/agent-settings/platform?platform=cloud",
		);
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
				status={getHealthProps(cloudEnvState.healthStatus).status}
				text={getHealthProps(cloudEnvState.healthStatus).text}
			/>
		</div>
		<div class="flex items-center gap-3">
			<Label class="text-muted-foreground min-w-18 font-normal"
				>{m.cloud_mode_openclaw_status()}</Label
			>
			<StatusIndicator
				status={getHealthProps(cloudEnvState.openClawStatus).status}
				text={getHealthProps(cloudEnvState.openClawStatus).text}
			/>
		</div>
	</div>
	{#if !cloudEnvState.activated}
		<Button size="sm" onclick={handleActivate}>
			{m.cloud_mode_activate_button()}
		</Button>
	{/if}
</div>
