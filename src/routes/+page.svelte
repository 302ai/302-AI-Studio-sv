<script lang="ts">
	import { goto } from "$app/navigation";
	import { persistedActiveTabId, persistedTabs } from "$lib/stores/tab-bar-state.svelte";
	import { onMount } from "svelte";

	onMount(() => {
		const activeTabId = persistedActiveTabId.current;
		const tabs = persistedTabs.current;
		const activeTab = tabs.find((tab) => tab.id === activeTabId);

		if (activeTab) {
			goto(activeTab.href, { replaceState: true });
		}
	});
</script>

<div class="flex h-screen items-center justify-center">
	<div class="text-center">
		<div class="mb-4 text-lg">Redirecting...</div>
		<div
			class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
		></div>
	</div>
</div>
