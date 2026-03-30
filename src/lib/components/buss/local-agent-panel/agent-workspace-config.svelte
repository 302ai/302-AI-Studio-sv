<script lang="ts">
	import { SegButton, SettingSelect } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent";
	import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { cn } from "$lib/utils";
	import { RefreshCcw } from "@lucide/svelte";
	import { agentClass } from "@shared/storage/code-agent";
	import { onMount } from "svelte";
	import { ButtonWithTooltip } from "../button-with-tooltip";
	import OpenClawChannelPanel from "../open-claw-config-panel/open-claw-channel-panel.svelte";

	const frameworkOptions = [
		{
			key: "claude-code",
			label: m.agent_framework_claude_code_label(),
			description: m.agent_framework_claude_code_description(),
		},
		{
			key: "open-claw",
			label: m.agent_framework_open_claw_label(),
			description: m.agent_framework_open_claw_description(),
		},
	];

	async function handleRefresh() {
		await localClaudeCodeSandboxState.refreshSessions();
	}

	function handleCodeAgentSelected(codeAgentId: string) {
		if (agentClass.allows(codeAgentId)) {
			codeAgentState.updateCurrentAgentId(codeAgentId);
		}
	}

	onMount(async () => {
		await localClaudeCodeSandboxState.refreshSessions();
	});
</script>

<div class="space-y-4">
	<!-- Agent Framework -->
	<div class="space-y-2">
		<Label class="text-label-fg font-normal">{m.title_agent()}</Label>
		<SegButton
			class="!h-[52px]"
			thumbClass="!h-[40px]"
			options={frameworkOptions}
			selectedKey={codeAgentState.currentAgentId}
			onSelect={handleCodeAgentSelected}
		/>
	</div>

	{#if codeAgentState.currentAgentId == "open-claw"}
		<!-- NOTE: Hidden channel configuration -->
		<!-- <OpenClawConfigPanel className="hidden" /> -->
		<OpenClawChannelPanel />
	{/if}

	<!-- Select Session -->
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<Label class="text-label-fg font-normal">{m.local_platform_select_session()}</Label>
			<ButtonWithTooltip
				class="hover:!bg-chat-action-hover"
				tooltip={m.label_button_reload()}
				onclick={handleRefresh}
				disabled={localClaudeCodeSandboxState.isLoading}
			>
				<RefreshCcw
					class={cn("h-4 w-4", localClaudeCodeSandboxState.isLoading ? "animate-spin" : "")}
				/>
			</ButtonWithTooltip>
		</div>
		<SettingSelect
			name="Select Session"
			value={localClaudeCodeSandboxState.selectedSessionId}
			groupedOptions={localClaudeCodeSandboxState.sessionOptions}
			placeholder={m.local_platform_new_session_placeholder()}
			onValueChange={localClaudeCodeSandboxState.handleSessionSelected.bind(
				localClaudeCodeSandboxState,
			)}
			contentClass="w-[var(--bits-select-anchor-width)]"
		/>
	</div>

	<!-- Work Directory -->
	<div class="space-y-2">
		<Label class="text-label-fg font-normal">{m.local_platform_work_directory()}</Label>
		<SettingSelect
			name="Work Directory"
			value={localClaudeCodeSandboxState.selectedWorkspacePath}
			groupedOptions={localClaudeCodeSandboxState.workspaceOptions}
			placeholder={m.local_platform_new_work_directory_placeholder()}
			onValueChange={localClaudeCodeSandboxState.handleWorkspaceSelected.bind(
				localClaudeCodeSandboxState,
			)}
			contentClass="w-[var(--bits-select-anchor-width)]"
		/>
	</div>
</div>
