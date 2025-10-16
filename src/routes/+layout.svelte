<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { FpsDisplay } from "$lib/components/ui/fps-display";
	import { Toaster } from "$lib/components/ui/sonner";
	import "$lib/stores";
	import { isDev } from "$lib/utils/env";
	import "$lib/utils/key-manager";
	import "$lib/utils/shortcut-actions-handler";
	import { shortcutActionsHandler } from "$lib/utils/shortcut-actions-handler";
	import { ModeWatcher } from "mode-watcher";
	import { onMount } from "svelte";
	import "../app.css";

	const { children } = $props();

	onMount(() => {
		// Only initialize shortcut actions handler in tab views (chat pages)
		// Shell view handles its own shortcuts in shell/+layout.svelte
		const isShellView = window.location.pathname.startsWith("/shell");
		if (!isShellView) {
			shortcutActionsHandler.init();
		}

		return () => {
			if (!isShellView) {
				shortcutActionsHandler.destroy();
			}
		};
	});
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
