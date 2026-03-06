<script lang="ts">
	import { SegButton } from "$lib/components/buss/settings";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { cn } from "$lib/utils";
	import ClaudeCodeRaw from "@lobehub/icons-static-svg/icons/claudecode.svg?raw";
	import OpenClawRaw from "@lobehub/icons-static-svg/icons/openclaw.svg?raw";

	function handleAgentSelect(key: string) {
		codeAgentState.updateCurrentAgentId(key as "claude-code" | "open-claw");
	}
</script>

{#snippet claudeIcon()}
	<span
		class={cn(
			"flex h-4 w-4 items-center justify-center dark:text-white [&>svg]:h-full [&>svg]:w-full",
			codeAgentState.currentAgentId === codeAgentState.codingAgentId && "text-primary",
		)}
		title="Claude Code"
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html ClaudeCodeRaw}
	</span>
{/snippet}

{#snippet openClawIcon()}
	<span
		class={cn(
			"flex h-4 w-4 items-center justify-center dark:text-white [&>svg]:h-full [&>svg]:w-full",
			codeAgentState.currentAgentId === "open-claw" && "text-primary",
		)}
		title="Open Claw"
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html OpenClawRaw}
	</span>
{/snippet}

<SegButton
	options={[
		{ key: codeAgentState.codingAgentId, label: "CC", iconSnippet: claudeIcon },
		{ key: "open-claw", label: "OC", iconSnippet: openClawIcon },
	]}
	selectedKey={codeAgentState.currentAgentId}
	onSelect={handleAgentSelect}
	class="!h-7 !rounded-md !px-1 bg-muted"
	thumbClass="!h-5 text-xs rounded px-1"
/>
