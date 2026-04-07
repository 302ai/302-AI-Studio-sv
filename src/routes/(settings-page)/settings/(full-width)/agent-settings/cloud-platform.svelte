<script lang="ts">
	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";

	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { Switch } from "$lib/components/ui/switch";
	import { m } from "$lib/paraglide/messages";
	import { cloudEnvState } from "$lib/stores/code-agent/cloud-env-state.svelte";

	let bool = $state(false);
</script>

<div class="flex flex-col space-y-6">
	<div class="space-y-2">
		<h2 class="text-sm font-medium">{m.local_platform_environment_monitoring()}</h2>
		<div class="rounded-lg border p-5 space-y-5">
			<div class="flex items-start justify-between gap-4">
				<div class="flex-1 space-y-3">
					<div class="flex items-center gap-3">
						<Label class="text-muted-foreground min-w-18 font-normal"
							>{m.agent_settings_instance_status()}</Label
						>
						<StatusIndicator
							status={cloudEnvState.instanceStatus === "healthy" ? "green" : "gray"}
							text={cloudEnvState.instanceStatus === "healthy"
								? m.cloud_mode_healthy()
								: m.cloud_mode_unknown()}
						/>
					</div>
					<div class="flex items-center gap-3">
						<Label class="text-muted-foreground min-w-18 font-normal"
							>{m.cloud_mode_api_status()}</Label
						>
						<StatusIndicator
							status={cloudEnvState.apiStatus === "healthy" ? "green" : "gray"}
							text={cloudEnvState.apiStatus === "healthy"
								? m.cloud_mode_healthy()
								: m.cloud_mode_unknown()}
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

	<div class="space-y-2">
		<h2 class="text-sm font-medium">订阅信息</h2>
		<div class="rounded-lg border p-5 space-y-5">
			<div class="flex justify-between items-center w-full">
				<h3 class="text-base font-semibold">云主机</h3>
				<Button size="sm" onclick={() => cloudEnvState.startCloud()}>
					{m.cloud_mode_activate_button()}
				</Button>
			</div>
			<div class="flex justify-between items-end">
				{#if bool}
					<div class="space-y-1">
						<p class="text-sm text-muted-foreground">生效日期： 2026-04-01</p>
						<p class="text-sm text-muted-foreground">生效日期： 2026-04-01</p>
					</div>
				{:else}
					<div class="space-y-1">
						<p class="text-sm text-muted-foreground">按月付费，持续运行</p>
						<p class="text-sm text-muted-foreground">按月付费，持续运行</p>
						<p class="text-sm text-muted-foreground">按月付费，持续运行</p>
					</div>
				{/if}
				<div class="flex items-center">
					<Switch
						class="data-[state=unchecked]:border-settings-switch-border cursor-pointer"
					/>
					<span class="text-sm text-muted-foreground ml-2"> 自动续费 </span>
				</div>
			</div>
		</div>
	</div>
</div>
