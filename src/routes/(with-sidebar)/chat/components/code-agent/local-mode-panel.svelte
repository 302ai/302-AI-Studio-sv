<script lang="ts" module>
	export interface Props {
		onClose?: () => void;
	}
</script>

<script lang="ts">
	import AgentWorkspaceConfig from "$lib/components/buss/local-agent-panel/agent-workspace-config.svelte";
	import PodmanCard from "$lib/components/buss/local-agent-panel/podman-card.svelte";
	import SandboxCard from "$lib/components/buss/local-agent-panel/sandbox-card.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentGlobalConfigsState } from "$lib/stores/code-agent/code-agent-global-configs-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { mcpState } from "$lib/stores/mcp-state.svelte";
	import { toast } from "svelte-sonner";

	let { onClose }: Props = $props();

	async function handleInstall() {
		await localEnvState.installPodman();
	}

	function handleLocalModeConfirm() {
		const sessionId = localClaudeCodeSandboxState.selectedSessionId;
		const workspacePath = localClaudeCodeSandboxState.selectedWorkspacePath;

		if (codeAgentState.currentAgentId === "open-claw") {
			console.log(codeAgentGlobalConfigsState.currentCredentials);
			console.log(codeAgentGlobalConfigsState.openClawConfig);

			const { appid, appSecret } = codeAgentGlobalConfigsState.currentCredentials;
			if (!appid.trim() || !appSecret.trim()) {
				toast.warning(m.toast_open_claw_missing_credentials());
				return;
			}
		}

		// Get skills (same as remote mode)
		codeAgentState.getSkillList(true);

		// Filter incompatible MCP servers (same as remote mode)
		if (chatState.mcpServerIds.length > 0) {
			const { compatibleIds, filteredNames } = mcpState.filterStreamableHTTPServers(
				chatState.mcpServerIds,
			);

			if (filteredNames.length > 0) {
				toast.warning(m.mcp_filtered_warning({ names: filteredNames.join(", ") }));
				chatState.handleMCPServerChange(compatibleIds);
			}
		}

		// Call handleLocalEnabled to update persisted state
		codeAgentState.handleLocalEnabled(sessionId, workspacePath);

		// Set enabled and close panel
		codeAgentState.updateEnabled(true, false);
		onClose?.();
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<!-- Section 1: Environment Monitoring -->
	<section class="space-y-4">
		<Label class="text-label-fg font-normal">{m.local_platform_environment_monitoring()}</Label>

		<!-- Environment Cards Container -->
		<div class="rounded-lg border p-4 space-y-4">
			<PodmanCard isOpen={false} onInstall={handleInstall} />
			<SandboxCard isOpen={false} />
		</div>
	</section>

	<!-- Section 2: Agent Framework -->
	<section class="space-y-4 mt-2">
		<AgentWorkspaceConfig />
	</section>

	<!-- Footer with Cancel/Confirm buttons -->
	<div class="flex flex-row justify-between">
		<Button variant="secondary" onclick={onClose}>
			{m.common_cancel()}
		</Button>
		<Button onclick={handleLocalModeConfirm}>
			{m.label_button_confirm()}
		</Button>
	</div>
</div>
