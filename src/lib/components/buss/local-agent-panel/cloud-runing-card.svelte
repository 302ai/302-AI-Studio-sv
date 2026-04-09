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
	import { Skeleton } from "$lib/components/ui/skeleton";
	import { m } from "$lib/paraglide/messages";
	import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { RefreshCw } from "@lucide/svelte";
	import { onDestroy, onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { cn } from "tailwind-variants";
	import { ButtonWithTooltip } from "../button-with-tooltip";

	let { state, openClaw, loading } = $derived(cloudModeState);

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

	function handleActivate() {
		window.electronAPI.windowService.handleOpenSettingsWindow(
			"/settings/agent-settings/platform?platform=cloud",
		);
	}

	onMount(() => {
		try {
			cloudModeState.initStatus();
		} catch (e) {
			toast.error("云端环境状态加载失败，请稍后重试" + e);
		}
	});

	onDestroy(() => {
		cloudModeState.dispose();
	});
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
					status={getHealthProps(state.status).status}
					text={getHealthProps(state.status).text}
					warningTooltip={m.cloud_mode_unhealthy()}
				/>
				<ButtonWithTooltip
					onclick={() => cloudModeState.restartMachine()}
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
					status={openClaw.status ? "green" : "red"}
					text={openClaw.status ? m.cloud_mode_healthy() : m.cloud_mode_unhealthy()}
					warningTooltip={m.cloud_mode_unhealthy()}
				/>
			</div>
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-18 font-normal">接口状态</Label>
				<StatusIndicator
					status={openClaw.api_status ? "green" : "red"}
					text={openClaw.api_status ? m.cloud_mode_healthy() : m.cloud_mode_unhealthy()}
					warningTooltip={m.cloud_mode_unhealthy()}
				/>
			</div>
		</div>
		{#if state.expired}
			<Button size="sm" onclick={handleActivate}>
				{m.cloud_mode_activate_button()}
			</Button>
		{/if}
	</div>
{/if}
