<script lang="ts">
	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";

	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";

	let sandboxRunning = $state(false);
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
						status={sandboxRunning ? "green" : "gray"}
						text={sandboxRunning
							? m.cloud_mode_running()
							: m.agent_settings_not_activated()}
					/>
				</div>
				<div class="flex items-center gap-3">
					<Label class="text-muted-foreground min-w-18 font-normal"
						>{m.cloud_mode_startup_status()}</Label
					>
					<StatusIndicator
						status={sandboxRunning ? "green" : "gray"}
						text={sandboxRunning ? m.settings_normal() : m.local_platform_unhealthy()}
					/>
				</div>
			</div>
			<Button
				size="sm"
				variant={sandboxRunning ? "destructive" : "default"}
				onclick={() => console.log("TODO: toggle cloud mode is Not implemented")}
			>
				{m.cloud_mode_activate_button()}
			</Button>
		</div>
	</div>
</div>
