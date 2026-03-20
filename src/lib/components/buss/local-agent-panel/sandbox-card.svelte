<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import {
		localEnvState,
		type SandboxHealthStatus,
	} from "$lib/stores/code-agent/local-env-state.svelte";
	import { cn } from "$lib/utils";
	import { LoaderCircle, RefreshCw } from "@lucide/svelte";
	import { onMount } from "svelte";
	import LogDialog from "./log-dialog.svelte";
	import PlatformServiceCard from "./platform-service-card.svelte";
	import StatusIndicator from "./status-indicator.svelte";

	let { isOpen = $bindable(true) }: { isOpen?: boolean } = $props();

	// Local UI state for log dialog
	let isSandboxLogOpen = $state(false);
	let isRestarting = $state(false);

	// Sandbox Logic - use derived state from localEnvState
	let sandboxRunning = $derived(localEnvState.sandboxRunning);
	let isSandboxLoading = $derived(localEnvState.sandboxStarting);
	let podmanInstalled = $derived(localEnvState.podmanInstalled);
	let healthStatus = $derived(localEnvState.sandboxHealthStatus);
	let openClawHealthStatus = $derived(localEnvState.openClawHealthStatus);
	let sandboxLogs = $derived(localEnvState.sandboxLogs);
	let sandboxFailed = $derived(localEnvState.sandboxFailed);
	let fileDirectory = $state("");

	// Show log button when there are logs, or sandbox is starting/failed
	let showLogButton = $derived(sandboxLogs.length > 0 || isSandboxLoading || sandboxFailed);

	// Helper to get status indicator props
	function getHealthStatusProps(status: SandboxHealthStatus) {
		switch (status) {
			case "healthy":
				return { status: "green" as const, text: m.local_platform_healthy() };
			case "unhealthy":
				return { status: "red" as const, text: m.local_platform_unhealthy() };
			default:
				return { status: "gray" as const, text: m.local_platform_unknown() };
		}
	}

	let healthProps = $derived(
		!sandboxRunning
			? { status: "gray" as const, text: m.local_platform_unknown() }
			: getHealthStatusProps(healthStatus),
	);
	let openClawHealthProps = $derived(
		!sandboxRunning
			? { status: "gray" as const, text: m.local_platform_unknown() }
			: getHealthStatusProps(openClawHealthStatus),
	);

	async function handleStartSandbox() {
		if (sandboxRunning) {
			await localEnvState.stopSandbox();
		} else {
			await localEnvState.startSandbox();
		}
	}

	function handleOpenLogs() {
		isSandboxLogOpen = true;
	}

	async function handleRestartGateway() {
		isRestarting = true;
		try {
			await window.electronAPI.localVibeService.restartPodmanMachine();
		} finally {
			isRestarting = false;
		}
	}

	async function handleOpenDirectory() {
		await window.electronAPI.localVibeService.openComposeDirectory();
	}

	onMount(async () => {
		localEnvState.startSandboxListening();
		try {
			fileDirectory = await window.electronAPI.localVibeService.getComposeDirectory();
		} catch (error) {
			console.error("Failed to get compose directory:", error);
		}
	});
</script>

<PlatformServiceCard title={m.local_platform_local_sandbox()} bind:isOpen>
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-2">
			<!-- Startup Status -->
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_startup_status()}</Label
				>
				<StatusIndicator
					status={sandboxRunning ? "green" : "gray"}
					text={sandboxRunning ? m.local_platform_started() : m.local_platform_not_started()}
				/>
			</div>
			<!-- Health Status -->
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_health_status()}</Label
				>
				<StatusIndicator
					status={healthProps.status}
					text={healthProps.text}
					showWarning={healthStatus === "unhealthy"}
					warningTooltip={m.local_platform_try_restart()}
				/>
			</div>
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_open_claw()}</Label
				>
				<StatusIndicator
					status={openClawHealthProps.status}
					text={openClawHealthProps.text}
					showWarning={openClawHealthStatus === "unhealthy"}
					warningTooltip={m.local_platform_try_restart()}
				/>
				{#if openClawHealthStatus === "unhealthy" || isRestarting}
					<ButtonWithTooltip
						tooltip={m.local_platform_restart_gateway()}
						class="hover:!bg-icon-btn-hover size-8"
						onclick={handleRestartGateway}
						disabled={isRestarting}
					>
						<RefreshCw class={cn("h-4 w-4", isRestarting && "animate-spin")} />
					</ButtonWithTooltip>
				{/if}
			</div>
			<!-- File Directory -->
			<div class="flex items-baseline gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_file_directory()}</Label
				>
				<button
					class="text-sm hover:underline cursor-pointer focus:outline-none text-left break-all text-primary"
					onclick={handleOpenDirectory}
					aria-label={m.local_platform_open_folder()}
				>
					{fileDirectory}
				</button>
			</div>
		</div>
		<div class="flex gap-2">
			{#if showLogButton}
				<Button size="sm" variant="secondary" onclick={handleOpenLogs} class="min-w-[60px]">
					{m.local_platform_logs()}
				</Button>
			{/if}
			<Button
				size="sm"
				variant={sandboxRunning ? "destructive" : "default"}
				onclick={handleStartSandbox}
				disabled={isSandboxLoading || !podmanInstalled}
			>
				{#if isSandboxLoading}
					<LoaderCircle class="h-4 w-4 animate-spin" />
					{sandboxRunning ? m.local_platform_stopping() : m.local_platform_starting()}
				{:else}
					{sandboxRunning ? m.local_platform_close() : m.local_platform_one_click_start()}
				{/if}
			</Button>
		</div>
	</div>
</PlatformServiceCard>

<!-- Log Dialog -->
<LogDialog
	bind:open={isSandboxLogOpen}
	title={m.local_platform_local_sandbox()}
	logs={sandboxLogs}
/>
