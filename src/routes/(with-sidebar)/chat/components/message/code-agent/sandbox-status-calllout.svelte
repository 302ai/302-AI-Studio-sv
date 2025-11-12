<script lang="ts">
	import * as Alert from "$lib/components/ui/alert/index.js";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent";
	import { Box, Codesandbox } from "@lucide/svelte";
	import { onMount } from "svelte";

	interface Props {
		show: boolean;
	}

	let { show }: Props = $props();
	let showBoxIcon = $state(true);

	onMount(() => {
		const interval = setInterval(() => {
			showBoxIcon = !showBoxIcon;
		}, 1000);

		return () => clearInterval(interval);
	});
</script>

{#if show && codeAgentState.enabled}
	<Alert.Root>
		{#if showBoxIcon}
			<Box />
		{:else}
			<Codesandbox />
		{/if}
		<Alert.Title class="font-normal"
			>{codeAgentState.sandboxStatus === "waiting-for-sandbox"
				? m.sandbox_creating()
				: m.sandbox_created()}</Alert.Title
		>
	</Alert.Root>
{/if}
