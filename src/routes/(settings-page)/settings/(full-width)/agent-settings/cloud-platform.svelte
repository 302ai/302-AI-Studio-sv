<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";

	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { Switch } from "$lib/components/ui/switch";
	import { m } from "$lib/paraglide/messages";
	import {
		cloudModeState,
		type CloudHealthStatus,
	} from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { cn } from "$lib/utils";
	import { LoaderCircle, RefreshCw } from "@lucide/svelte";

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

	function formatDate(iso?: string): string {
		if (!iso) return "--";
		return new Date(iso).toLocaleDateString();
	}

	$effect(() => {
		cloudModeState.startPolling();
		return () => cloudModeState.stopPolling();
	});

	// --- Restart / Reboot ---
	let isRestartingDocker = $state(false);
	let isRebooting = $state(false);
	let isAutoRenew = $state(false);

	async function handleRestartDockerAction() {
		isRestartingDocker = true;
		try {
			await cloudModeState.restartDocker();
		} finally {
			isRestartingDocker = false;
		}
	}

	async function handleRebootAction() {
		isRebooting = true;
		try {
			await cloudModeState.rebootInstance();
		} finally {
			isRebooting = false;
		}
	}
</script>

<div class="flex flex-col space-y-6">
	<!-- 环境监测 -->
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
							status={getHealthProps(cloudModeState.instanceStatus).status}
							text={getHealthProps(cloudModeState.instanceStatus).text}
							showWarning={cloudModeState.instanceStatus === "unhealthy"}
							warningTooltip={m.cloud_mode_unhealthy()}
						/>
						{#if cloudModeState.instanceStatus === "unhealthy" || isRebooting}
							<ButtonWithTooltip
								tooltip={m.cloud_mode_reboot_instance()}
								class="hover:!bg-icon-btn-hover size-8"
								onclick={handleRebootAction}
								disabled={isRebooting}
							>
								<RefreshCw class={cn("h-4 w-4", isRebooting && "animate-spin")} />
							</ButtonWithTooltip>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<Label class="text-muted-foreground min-w-18 font-normal"
							>{m.cloud_mode_health_status()}</Label
						>
						<StatusIndicator
							status={getHealthProps(cloudModeState.healthStatus).status}
							text={getHealthProps(cloudModeState.healthStatus).text}
						/>
					</div>
					<div class="flex items-center gap-3">
						<Label class="text-muted-foreground min-w-18 font-normal"
							>{m.cloud_mode_openclaw_status()}</Label
						>
						<StatusIndicator
							status={getHealthProps(cloudModeState.openClawStatus).status}
							text={getHealthProps(cloudModeState.openClawStatus).text}
							showWarning={cloudModeState.openClawStatus === "unhealthy"}
							warningTooltip={m.cloud_mode_unhealthy()}
						/>
						{#if cloudModeState.openClawStatus === "unhealthy" || isRestartingDocker}
							<ButtonWithTooltip
								tooltip={m.cloud_mode_restart_docker()}
								class="hover:!bg-icon-btn-hover size-8"
								onclick={handleRestartDockerAction}
								disabled={isRestartingDocker}
							>
								<RefreshCw
									class={cn("h-4 w-4", isRestartingDocker && "animate-spin")}
								/>
							</ButtonWithTooltip>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- 订阅信息 -->
	<div class="space-y-2">
		<h2 class="text-sm font-medium">订阅信息</h2>
		<div class="rounded-lg border p-5 space-y-5">
			<div class="flex justify-between items-center w-full">
				<h3 class="text-base font-semibold">{m.cloud_mode_instance()}</h3>
				{#if !cloudModeState.activated}
					<Button
						size="sm"
						disabled={cloudModeState.starting}
						onclick={() => cloudModeState.startCloud(false, isAutoRenew)}
					>
						{#if cloudModeState.starting}
							<LoaderCircle class="h-4 w-4 animate-spin" />
						{:else}
							{m.cloud_mode_activate_button()}
						{/if}
					</Button>
				{/if}
			</div>
			<div class="flex justify-between items-end">
				<div class="space-y-1">
					{#if cloudModeState.instanceInfo}
						<p class="text-sm text-muted-foreground">
							IP：{cloudModeState.instanceInfo.publicIp || "--"}
						</p>
						<p class="text-sm text-muted-foreground">
							{m.cloud_mode_created_at()}：{formatDate(
								cloudModeState.instanceInfo.createdAt,
							)}
						</p>
						<p class="text-sm text-muted-foreground">
							{m.cloud_mode_expired_at()}：{formatDate(
								cloudModeState.instanceInfo.expiredAt,
							)}
						</p>
					{:else}
						<p class="text-sm text-muted-foreground">{m.cloud_mode_no_instance()}</p>
					{/if}
				</div>
				{#if !cloudModeState.activated}
					<div class="flex items-center">
						<Switch
							bind:checked={isAutoRenew}
							class="data-[state=unchecked]:border-settings-switch-border cursor-pointer"
						/>
						<span class="text-sm text-muted-foreground ml-2"
							>{m.cloud_mode_auto_renew()}</span
						>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- API Test Section (TODO: remove after testing) -->
	<!-- <div class="space-y-2">
		<h2 class="text-sm font-medium">{m.cloud_mode_api_test()}</h2>
		<Card class="p-4 space-y-3">
			<div class="flex flex-wrap gap-2">
				<Button size="sm" onclick={handleList} disabled={testLoading}>GET /instances</Button
				>
				<Button size="sm" onclick={handleCreate} disabled={testLoading}
					>POST /instances</Button
				>
				<Button size="sm" onclick={handleStatus} disabled={testLoading}>GET /status</Button>
				<Button size="sm" onclick={handleRestartDocker} disabled={testLoading}
					>POST /openclaw/restart</Button
				>
				<Button size="sm" onclick={handleReboot} disabled={testLoading}>POST /reboot</Button
				>
				<Button size="sm" onclick={handleReadFiles} disabled={testLoading}
					>POST /files/read</Button
				>
				<Button size="sm" onclick={handleWriteFiles} disabled={testLoading}
					>POST /files/write</Button
				>
				<Button size="sm" onclick={handleExec} disabled={testLoading}
					>POST /commands/exec</Button
				>
			</div>
			{#if testResult}
				<pre
					class="text-xs whitespace-pre-wrap break-all bg-muted p-3 rounded">{testResult}</pre>
			{/if}
		</Card>
	</div> -->
</div>
