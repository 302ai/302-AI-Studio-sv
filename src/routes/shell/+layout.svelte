<script lang="ts">
	import { ModeWatcher } from "mode-watcher";
	import "../../app.css";
	import TabBar from "./components/tab-bar/tab-bar.svelte";

	const { children } = $props();
</script>

<ModeWatcher />

<div class="flex w-screen h-screen flex-col">
	<TabBar />

	<main>
		{@render children?.()}
	</main>
</div>
