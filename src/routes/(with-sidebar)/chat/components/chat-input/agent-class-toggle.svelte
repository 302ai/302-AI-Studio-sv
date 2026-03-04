<script lang="ts">
	import { SegButton } from "$lib/components/buss/settings";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";

	const selectedAgent = $derived(codeAgentState.currentAgentId);
	const agentOptions = [
		{ key: "claude-code", label: "cc", tooltip: "claude-code" },
		{ key: "open-claw", label: "oc", tooltip: "open-claw" },
	];

	function handleAgentSelect(key: string) {
		codeAgentState.updateCurrentAgentId(key as "claude-code" | "open-claw");
	}
</script>

<SegButton
	options={agentOptions}
	selectedKey={selectedAgent}
	onSelect={handleAgentSelect}
	class="!h-7 w-[72px] !rounded-md !px-1 bg-muted"
	thumbClass="!h-5 text-[11px] rounded px-1"
	activeThumbClass="text-white"
	leftThumbClass="bg-primary"
	contentClass="gap-0"
/>
