<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { cn } from "$lib/utils";
	import mcpIcon from "@lobehub/icons-static-svg/icons/mcp.svg";
	import { Globe, Lightbulb, Settings2 } from "@lucide/svelte";
	import { AttachmentUploader } from "../attachment";
	import ParametersOverlay from "./parameters-overlay.svelte";
	import ParametersPanel from "./parameters-panel.svelte";
	import { McpServerSelector } from "$lib/components/buss/mcp-server-selector";

	let actionDisabled = $derived(chatState.providerType !== "302ai");
	let isParametersOpen = $state(false);
	let isMCPSelectorOpen = $state(false);

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

	<ParametersOverlay
		title={m.title_chat_parameters()}
		open={isParametersOpen}
		onClose={handleParametersClose}
	>
		<ParametersPanel />
	</ParametersOverlay>
{/snippet}

{#snippet actionUploadAttachment()}
	<AttachmentUploader />
{/snippet}

<div class="flex h-chat-bar items-center gap-chat-bar-gap">
	{@render actionUploadAttachment()}
	{#if chatState.providerType === "302ai"}
		{@render actionEnableThinking()}
		{@render actionEnableOnlineSearch()}
	{/if}
	{@render actionEnableMCP()}
	{@render actionSetParameters()}
</div>
