<script lang="ts">
	import { goto } from "$app/navigation";
	import { onMount } from "svelte";

	onMount(() => {
		goto(window.tab.href);
	});
</script>

<div class="flex h-screen items-center justify-center">
	<!-- <LdrsLoader type="waveform" /> -->
</div>
