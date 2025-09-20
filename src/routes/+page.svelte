<script lang="ts">
	import { goto } from "$app/navigation";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { onMount } from "svelte";

	const { tabService } = window.electronAPI;

	onMount(async () => {
		const activeTab = await tabService.getActiveTab();
		if (activeTab) {
			console.log(activeTab.href);
			goto(activeTab.href);
		}
	});
</script>

<div class="flex h-screen items-center justify-center">
	<LdrsLoader type="waveform" />
</div>
