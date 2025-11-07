<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { McpServerSelector } from "$lib/components/buss/mcp-server-selector";
	import { Overlay } from "$lib/components/buss/overlay";
	import Switch from "$lib/components/ui/switch/switch.svelte";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent-state.svelte";
	import { cn } from "$lib/utils";
	import mcpIcon from "@lobehub/icons-static-svg/icons/mcp.svg";
	import { Globe, HatGlasses, Lightbulb, Settings2 } from "@lucide/svelte";
	import { AttachmentUploader } from "../attachment";
	import CodeAgentPanel from "../code-agent/code-agent-panel.svelte";
	import ParametersPanel from "./parameters-panel.svelte";

	let actionDisabled = $derived(chatState.providerType !== "302ai");
	let isParametersOpen = $state(false);
	let isMCPSelectorOpen = $state(false);
	let isCodeAgentOpen = $state(false);

	function handleParametersClose() {
		isParametersOpen = false;
	}

	function handleMCPSelectorClose() {
		isMCPSelectorOpen = false;
	}

	function handleMCPClick() {
		isMCPSelectorOpen = true;
	}

	function handleMCPServerConfirm(selectedIds: string[]) {
		chatState.handleMCPServerIdsChange(selectedIds);
		chatState.handleMCPActiveChange(selectedIds.length > 0);
	}
</script>

{#snippet actionEnableThinking()}
	<ButtonWithTooltip
		class={cn(
			"hover:!bg-chat-action-hover",
			chatState.isThinkingActive && "!bg-chat-action-active hover:!bg-chat-action-active",
		)}
		tooltip={actionDisabled ? m.title_unsupport_action() : m.title_thinking()}
		onclick={() => chatState.handleThinkingActiveChange(!chatState.isThinkingActive)}
	>
		<Lightbulb class={cn(chatState.isThinkingActive && "!text-chat-action-active-fg")} />
	</ButtonWithTooltip>
{/snippet}

{#snippet actionEnableOnlineSearch()}
	<ButtonWithTooltip
		class={cn(
			"hover:!bg-chat-action-hover",
			chatState.isOnlineSearchActive && "!bg-chat-action-active hover:!bg-chat-action-active",
		)}
		tooltip={actionDisabled ? m.title_unsupport_action() : m.title_online_search()}
		onclick={() => chatState.handleOnlineSearchActiveChange(!chatState.isOnlineSearchActive)}
	>
		<Globe class={cn(chatState.isOnlineSearchActive && "!text-chat-action-active-fg")} />
	</ButtonWithTooltip>
{/snippet}

{#snippet actionEnableMCP()}
	<ButtonWithTooltip
		class={cn(
			"hover:!bg-chat-action-hover",
			chatState.isMCPActive && "!bg-chat-action-active hover:!bg-chat-action-active",
		)}
		tooltip={m.title_mcpServers()}
		onclick={handleMCPClick}
	>
		<img
			src={mcpIcon}
			alt="MCP"
			class={cn(
				"size-chat-icon group-hover:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:invert",
				chatState.isMCPActive &&
					"[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)]",
			)}
		/>
	</ButtonWithTooltip>

	<McpServerSelector
		bind:open={isMCPSelectorOpen}
		selectedServerIds={chatState.mcpServerIds}
		onClose={handleMCPSelectorClose}
		onConfirm={handleMCPServerConfirm}
	/>
{/snippet}

{#snippet actionSetParameters()}
	<ButtonWithTooltip
		class="hover:!bg-chat-action-hover"
		tooltip={m.title_chat_parameters()}
		onclick={() => (isParametersOpen = true)}
	>
		<Settings2 />
	</ButtonWithTooltip>

	<Overlay
		title={m.title_chat_parameters()}
		open={isParametersOpen}
		onClose={handleParametersClose}
	>
		<ParametersPanel />
	</Overlay>
{/snippet}

{#snippet actionUploadAttachment()}
	<AttachmentUploader />
{/snippet}

{#snippet actionCodeAgent()}
	<ButtonWithTooltip
		class={cn(
			"hover:!bg-chat-action-hover",
			codeAgentState.enabled && "!bg-chat-action-active hover:!bg-chat-action-active",
		)}
		tooltip={m.title_code_agent()}
		onclick={() => (isCodeAgentOpen = true)}
	>
		<HatGlasses class={cn(codeAgentState.enabled && "!text-chat-action-active-fg")} />
	</ButtonWithTooltip>

	<Overlay
		title={m.title_code_agent()}
		open={isCodeAgentOpen}
		onClose={() => (isCodeAgentOpen = false)}
	>
		<CodeAgentPanel />
		<Switch
			class={cn("absolute top-4 right-12", "data-[state=unchecked]:border-settings-switch-border")}
			checked={codeAgentState.enabled}
			onCheckedChange={(checked) => codeAgentState.updateState({ enabled: checked })}
		/>
	</Overlay>
{/snippet}

<div class="flex h-chat-bar items-center gap-chat-bar-gap">
	{@render actionUploadAttachment()}
	{#if chatState.providerType === "302ai"}
		{@render actionEnableThinking()}
		{@render actionEnableOnlineSearch()}
		{@render actionCodeAgent()}
	{/if}
	{@render actionEnableMCP()}
	{@render actionSetParameters()}
</div>
