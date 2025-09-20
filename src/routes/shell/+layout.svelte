<script lang="ts">
	import { TabBar } from "$lib/components/buss/tab-bar";
	import { ModeWatcher } from "mode-watcher";
	import "../../app.css";

	const { children } = $props();
</script>

<ModeWatcher />

<div class="flex w-screen h-screen flex-col">
	<TabBar />

	<main>
		{@render children?.()}
	</main>
</div>
