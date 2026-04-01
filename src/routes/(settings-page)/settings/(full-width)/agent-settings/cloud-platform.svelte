<script lang="ts">
	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";

	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { cloudEnvState } from "$lib/stores/code-agent/cloud-env-state.svelte";
</script>

<div class="space-y-2">
	<h2 class="text-sm">{m.local_platform_environment_monitoring()}</h2>
	<div class="rounded-lg border p-4 space-y-4">
		<div class="flex items-start justify-between gap-4">
			<div class="flex-1 space-y-2">
				<div class="flex items-center gap-3">
					<Label class="text-muted-foreground min-w-18 font-normal"
						>{m.agent_settings_instance_status()}</Label
					>
					<StatusIndicator
						status={cloudEnvState.activated ? "green" : "gray"}
						text={cloudEnvState.activated
							? m.cloud_mode_running()
							: m.agent_settings_not_activated()}
					/>
				</div>
				<div class="flex items-center gap-3">
					<Label class="text-muted-foreground min-w-18 font-normal"
						>{m.cloud_mode_startup_status()}</Label
					>
					<StatusIndicator
						status={cloudEnvState.running ? "green" : "gray"}
						text={cloudEnvState.running
							? m.settings_normal()
							: m.local_platform_unhealthy()}
					/>
				</div>
			</div>
			{#if !cloudEnvState.activated}
				<Button size="sm" onclick={() => cloudEnvState.startCloud()}>
					{m.cloud_mode_activate_button()}
				</Button>
			{:else if cloudEnvState.running}
				<Button
					size="sm"
					variant="destructive"
					disabled={cloudEnvState.starting}
					onclick={() => cloudEnvState.stopCloud()}
				>
					{m.cloud_mode_not_started()}
				</Button>
			{:else}
				<Button
					size="sm"
					disabled={cloudEnvState.starting}
					onclick={() => cloudEnvState.startCloud()}
				>
					{m.cloud_mode_started()}
				</Button>
			{/if}
		</div>
	</div>
</div>
