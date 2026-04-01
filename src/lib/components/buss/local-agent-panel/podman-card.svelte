<script lang="ts" module>
	export interface Props {
		isOpen: boolean;
		onInstall: () => Promise<void> | void;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { getLocale } from "$lib/paraglide/runtime";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { isWindows } from "$lib/utils/platform";
	import { ExternalLink, LoaderCircle } from "@lucide/svelte";
	import { onDestroy, onMount } from "svelte";
	import LogDialog from "./log-dialog.svelte";
	import PlatformServiceCard from "./platform-service-card.svelte";
	import StatusIndicator from "./status-indicator.svelte";

	let { isOpen = $bindable(true), onInstall }: Props = $props();

	// Local UI state for log dialog
	let isPodmanLogOpen = $state(false);

	// Derived state from localEnvState
	let podmanInstalled = $derived(localEnvState.podmanInstalled);
	let podmanHealth = $derived(localEnvState.podmanHealth);
	let isPodmanInstalling = $derived(localEnvState.installing);
	let installFailed = $derived(localEnvState.installFailed);
	let installLogs = $derived(localEnvState.installLogs);

	// Format logs for display
	let formattedLogs = $derived(
		installLogs.map((log) => {
			const prefix =
				log.type === "error"
					? "[ERROR]"
					: log.type === "stderr"
						? "[WARN]"
						: log.type === "complete"
							? "[DONE]"
							: "[INFO]";
			return `${prefix} [${log.step}] ${log.data}`;
		}),
	);

	// Primary button label logic
	let primaryButtonLabel = $derived.by(() => {
		if (isPodmanInstalling) return m.local_platform_installing();
		if (installFailed) return m.local_platform_reinstall();
		return m.code_agent_one_click_install();
	});

	// Log button should be visible when: not installed AND (has logs OR installing OR failed)
	let showLogButton = $derived(
		!podmanInstalled && (installLogs.length > 0 || isPodmanInstalling || installFailed),
	);

	async function handleInstallPodman() {
		await onInstall();
	}

	function handleOpenLogs() {
		isPodmanLogOpen = true;
	}

	onMount(async () => {
		// Start listening to broadcast channels for install logs and health checks
		localEnvState.startPodmanListening();

		// Refresh Podman installation status on mount
		await localEnvState.refreshPodmanStatus();

		// Start health check if Podman is installed
		await localEnvState.ensurePodmanHealthCheckStarted();
	});

	onDestroy(() => {
		// Stop listening to broadcast channels to avoid memory leaks
		localEnvState.stopPodmanListening();
	});
</script>

<PlatformServiceCard title={m.local_platform_podman()} bind:isOpen>
	<div class="flex items-start justify-between gap-4">
		<div class="flex-1 space-y-2">
			<!-- Installation Status -->
			<div class="flex items-center gap-3">
				<Label class="text-muted-foreground min-w-16 font-normal"
					>{m.local_platform_installation_status()}</Label
				>
				<StatusIndicator
					status={podmanInstalled ? "green" : "gray"}
					text={podmanInstalled
						? m.local_platform_installed()
						: m.local_platform_not_installed()}
				/>
			</div>
			<!-- Health Status -->
			{#if podmanInstalled}
				<div class="flex items-center gap-3">
					<Label class="text-muted-foreground min-w-16 font-normal"
						>{m.local_platform_health_status()}</Label
					>
					<StatusIndicator
						status={podmanHealth === "healthy"
							? "green"
							: podmanHealth === "unhealthy"
								? "red"
								: "gray"}
						text={podmanHealth === "healthy"
							? m.local_platform_healthy()
							: podmanHealth === "unhealthy"
								? m.local_platform_unhealthy()
								: m.local_platform_unknown()}
						showWarning={podmanHealth === "unhealthy"}
						warningTooltip={m.local_platform_try_restart()}
					/>
				</div>
			{/if}
		</div>
		<div class="flex shrink-0 gap-2">
			{#if showLogButton}
				<Button size="sm" variant="outline" onclick={handleOpenLogs}>
					{m.local_platform_logs()}
				</Button>
			{/if}
			{#if !podmanInstalled}
				{#if isWindows}
					{@const docUrl = `https://studio.302.ai/${getLocale()}/docs/advanced/local-sandbox/windows`}
					<Button
						size="sm"
						variant="outline"
						onclick={() => window.open(docUrl, "_blank")}
					>
						<ExternalLink class="mr-1 h-3.5 w-3.5" />
						{m.local_platform_install_guide()}
					</Button>
				{/if}
				<Button size="sm" onclick={handleInstallPodman} disabled={isPodmanInstalling}>
					{#if isPodmanInstalling}
						<LoaderCircle class="mr-1.5 h-4 w-4 animate-spin" />
					{/if}
					{primaryButtonLabel}
				</Button>
			{/if}
		</div>
	</div>
</PlatformServiceCard>

<!-- Log Dialog -->
<LogDialog
	bind:open={isPodmanLogOpen}
	title={m.local_platform_podman_logs()}
	logs={formattedLogs}
/>
