<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { FpsDisplay } from "$lib/components/ui/fps-display";
	import { Toaster } from "$lib/components/ui/sonner";
	import { isDev } from "$lib/utils/env";
	import { ModeWatcher } from "mode-watcher";
	import "../app.css";

	const { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ModeWatcher />
<Toaster position="top-center" richColors />

<div class="flex h-screen flex-col">
	<main class="h-full overflow-hidden">
		{@render children?.()}
	</main>
	{#if isDev}
		<FpsDisplay />
	{/if}
</div>
