<script lang="ts">
	import * as m from "$lib/paraglide/messages";
	import { LoaderCircle } from "@lucide/svelte";
	import { onMount } from "svelte";

	let webUiUrl = $state<string | null>(null);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			// Get the OpenClaw WebUI URL from the main process
			const url = await window.electronAPI.openClawService.getOpenClawWebUiUrl();
			webUiUrl = url;
		} catch (error) {
			console.error("[OpenClaw WebUI] Failed to get URL:", error);
		} finally {
			isLoading = false;
		}
	});
</script>

<div class="h-full w-full bg-background relative flex flex-col">
	{#if isLoading}
		<div class="flex-1 flex items-center justify-center">
			<LoaderCircle class="h-8 w-8 animate-spin text-muted-foreground" />
		</div>
	{:else if webUiUrl}
		<iframe
			src={webUiUrl}
			title="OpenClaw WebUI"
			class="flex-1 w-full h-full border-0 bg-white"
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
		></iframe>
	{:else}
		<div class="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
			<p class="text-sm">{m.openclaw_webui_failed_to_load()}</p>
			<p class="text-xs">{m.openclaw_webui_ensure_running()}</p>
		</div>
	{/if}
</div>
