<script lang="ts">
	import favicon from "$lib/assets/favicon.svg";
	import { TabBar } from "$lib/components/buss/tab-bar";
	import { Toaster } from "$lib/components/ui/sonner";
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
	<TabBar />

	<main class="h-[calc(100vh-env(titlebar-area-height,40px)-1px)] overflow-hidden">
		{@render children?.()}
	</main>
</div>
