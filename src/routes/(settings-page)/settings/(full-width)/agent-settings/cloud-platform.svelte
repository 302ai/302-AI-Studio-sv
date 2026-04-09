<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import StatusIndicator from "$lib/components/buss/local-agent-panel/status-indicator.svelte";
	import { Button } from "$lib/components/ui/button";
	// import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { Switch } from "$lib/components/ui/switch";
	import { m } from "$lib/paraglide/messages";
	import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { cn } from "$lib/utils";
	import { LoaderCircle, RefreshCw } from "@lucide/svelte";
	import { format, parseISO } from "date-fns";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";

	let state = $derived(cloudModeState.state);
	let openClaw = $derived(cloudModeState.openClaw);
	let loading = $derived(cloudModeState.loading);

	type StatusProps = { status: "green" | "red" | "gray"; text: string };

	function getHealthProps(s: "running" | "waiting_init" | "rebooting" | "rebooted"): StatusProps {
		switch (s) {
			case "running":
				return { status: "green", text: m.cloud_mode_healthy() };
			case "waiting_init":
				return { status: "gray", text: "初始化中..." };
			case "rebooting":
				return { status: "gray", text: "重启中..." };
			case "rebooted":
				return { status: "green", text: "重启完成" };
			default:
				return { status: "gray", text: m.cloud_mode_unknown() };
		}
	}

	function formatDate(iso?: string): string {
		if (!iso) return "--";
		return format(parseISO(iso), "yyyy-MM-dd");
	}

	onMount(() => {
		try {
			cloudModeState.initStatus();
		} catch (e) {
			toast.error("云端环境状态加载失败，请稍后重试" + e);
		}
	});

	async function handleAutoRenewChange(checked: boolean) {
		try {
			await cloudModeState.updateAutoRenew(checked);
		} catch (e) {
			toast.error("自动续费设置更新失败，请稍后重试" + e);
		}
	}
</script>

{#if loading.init}
	<div class="flex flex-col space-y-6">
		<div class="space-y-2">
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
		</div>
		<div class="space-y-2">
			<Skeleton class="h-5 w-24" />
			<div class="rounded-lg border p-5 space-y-5">
				<div class="flex justify-between items-center w-full">
					<Skeleton class="h-5 w-40" />
					<Skeleton class="h-4 w-28" />
				</div>
				<div class="space-y-1">
					<Skeleton class="h-4 w-48" />
					<Skeleton class="h-4 w-48" />
					<Skeleton class="h-4 w-48" />
				</div>
			</div>
		</div>
	</div>
{:else}
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
								status={getHealthProps(state.status).status}
								text={getHealthProps(state.status).text}
								warningTooltip={m.cloud_mode_unhealthy()}
							/>
							<ButtonWithTooltip
								onclick={() => cloudModeState.restartMachine()}
								tooltip={m.cloud_mode_reboot_instance()}
								class="hover:!bg-icon-btn-hover size-8"
							>
								<RefreshCw
									class={cn("h-4 w-4", loading.restart && "animate-spin")}
								/>
							</ButtonWithTooltip>
						</div>
						<div class="flex items-center gap-3">
							<Label class="text-muted-foreground min-w-18 font-normal"
								>{m.cloud_mode_openclaw_status()}</Label
							>
							<StatusIndicator
								status={openClaw.status ? "green" : "red"}
								text={openClaw.status
									? m.cloud_mode_healthy()
									: m.cloud_mode_unhealthy()}
								warningTooltip={m.cloud_mode_unhealthy()}
							/>
							<!-- {#if state.openClawStatus === "unhealthy" || isRestartingDocker}
							// showWarning={state.openClawStatus === "unhealthy"}
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
							{/if} -->
						</div>
						<div class="flex items-center gap-3">
							<Label class="text-muted-foreground min-w-18 font-normal"
								>接口状态</Label
							>
							<StatusIndicator
								status={openClaw.api_status ? "green" : "red"}
								text={openClaw.api_status
									? m.cloud_mode_healthy()
									: m.cloud_mode_unhealthy()}
								warningTooltip={m.cloud_mode_unhealthy()}
							/>
						</div>
					</div>
				</div>
			</div>
		</div>

		<div class="space-y-2">
			<h2 class="text-sm font-medium">{m.cloud_mode_subscription_info()}</h2>
			<div class="rounded-lg border p-5 space-y-5">
				<div class="flex justify-between items-center w-full">
					<h3 class="text-base font-semibold">{state.instanceName}</h3>
					{#if state.expired}
						<Button size="sm" onclick={() => void 0}>
							{#if loading.startVip}
								<LoaderCircle class="h-4 w-4 animate-spin" />
							{/if}
							{m.cloud_mode_activate_button()}
						</Button>
					{:else}
						<Button size="sm" onclick={() => {}}>
							{#if loading.startVip}
								<LoaderCircle class="h-4 w-4 animate-spin" />
							{:else}
								{m.cloud_mode_renew_button()}
							{/if}
						</Button>
						<!--						<span class="text-primary text-sm"> {m.cloud_mode_activated()} </span> -->
					{/if}
				</div>
				<div class="flex justify-between items-end">
					<div class="space-y-1">
						{#if !state.expired}
							<!-- <p class="text-sm text-muted-foreground">
								IP：{cloudModeState.instanceInfo.publicIp || "--"}
							</p> -->
							<p class="text-sm text-muted-foreground">
								{m.cloud_mode_created_at()}：{formatDate(state.createdAt)}
							</p>
							<p class="text-sm text-muted-foreground">
								{m.cloud_mode_expired_at()}：{formatDate(state.expiredAt)}
							</p>
						{:else}
							<p class="text-sm text-muted-foreground">
								{m.cloud_mode_no_instance()}
							</p>
						{/if}
					</div>
					<div class="flex items-center">
						{#if loading.autoRenew}
							<LoaderCircle class="h-4 w-4 animate-spin" />
						{/if}
						<Switch
							disabled={loading.autoRenew}
							checked={state.autoRenew}
							onCheckedChange={handleAutoRenewChange}
							class="data-[state=checked]:bg-primary cursor-pointer"
						/>
						<span class="text-sm text-muted-foreground ml-2"
							>{m.cloud_mode_auto_renew()}</span
						>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
