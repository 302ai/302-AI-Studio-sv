<script lang="ts">
	import OpenClawRaw from "$lib/assets/icons/code-agent/openclaw.svg?raw";
	import { Button } from "$lib/components/ui/button";
	import * as Empty from "$lib/components/ui/empty";
	import * as m from "$lib/paraglide/messages";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { cn } from "$lib/utils";
	import { LoaderCircle, Play, RefreshCw } from "@lucide/svelte";
	import { onMount } from "svelte";

	let webUiUrl = $state<string | null>(null);
	let isLoading = $state(true);

	const loadUrl = async () => {
		isLoading = true;
		try {
			// Get the OpenClaw WebUI URL from the main process
			const url = await window.electronAPI.openClawService.getOpenClawWebUiUrl();
			webUiUrl = url;
		} catch (error) {
			console.error("[OpenClaw WebUI] Failed to get URL:", error);
		} finally {
			isLoading = false;
		}
	};

	onMount(() => {
		loadUrl();
	});

	const handleStartSandbox = async () => {
		await localEnvState.startSandbox();
	};
</script>

{#snippet openClawIcon()}
	<span
		class={cn(
			"flex h-12 w-12 items-center justify-center dark:text-white [&>svg]:h-full [&>svg]:w-full",
		)}
		title="Open Claw"
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html OpenClawRaw}
	</span>
{/snippet}

<div class="h-full w-full bg-background relative flex flex-col">
	{#if isLoading || localEnvState.sandboxStarting || (localEnvState.sandboxHealthStatus === "healthy" && localEnvState.openClawHealthStatus !== "healthy")}
		<div class="flex-1 flex items-center justify-center">
			<LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
		</div>
	{:else if localEnvState.openClawHealthStatus === "healthy" && webUiUrl}
		<iframe
			src={webUiUrl}
			title="OpenClaw WebUI"
			class="flex-1 w-full h-full border-0 bg-white"
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
		></iframe>
	{:else}
		<div class="flex-1 flex flex-col items-center justify-center">
			<Empty.Root>
				<Empty.Header>
					<Empty.Media>
						{@render openClawIcon()}
					</Empty.Media>
					<Empty.Title>{m.openclaw_webui_failed_to_load()}</Empty.Title>
					<Empty.Description>{m.openclaw_webui_ensure_running()}</Empty.Description>
				</Empty.Header>
				<Empty.Content class="flex-row gap-4">
					<Button onclick={handleStartSandbox} disabled={localEnvState.sandboxStarting}>
						<Play class="h-4 w-4" />
						{m.code_agent_one_click_start()}
					</Button>
					<Button variant="secondary" onclick={loadUrl} disabled={isLoading}>
						<RefreshCw class="h-4 w-4" />
						{m.label_button_reload()}
					</Button>
				</Empty.Content>
			</Empty.Root>
		</div>
	{/if}
</div>
