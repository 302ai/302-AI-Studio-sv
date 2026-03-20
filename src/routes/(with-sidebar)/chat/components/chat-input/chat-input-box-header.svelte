<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { Overlay } from "$lib/components/buss/overlay";
	import { SegButton } from "$lib/components/buss/settings";
	import { Badge } from "$lib/components/ui/badge";
	import { m } from "$lib/paraglide/messages.js";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentGlobalConfigsState } from "$lib/stores/code-agent";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { MAX_ATTACHMENT_COUNT } from "$lib/utils/file-preview";
	import { Settings } from "@lucide/svelte";
	import CodeAgentPanel from "../code-agent/code-agent-panel.svelte";
	import AgentClassToggle from "./agent-class-toggle.svelte";

	let { onIsVibeChange } = $props<{
		onIsVibeChange: (isVibe: boolean) => void;
	}>();
	let selectedMode = $derived(codeAgentState.enabled ? "vibe" : "chat");

	const modeOptions = $derived([
		{ key: "chat", label: m.title_chat_mode() },
		{ key: "vibe", label: m.title_code_agent() },
	]);

	const isVibeLocal = $derived(codeAgentState.enabled && codeAgentState.type === "local");
	const agentIdLabelMap = new Map<"claude-code" | "open-claw", string>([
		["claude-code", "Claude Code"],
		["open-claw", "Open Claw"],
	]);
	const description = $derived.by(() => {
		// TODO: 支持远程 Open Claw 之后，移除由于当前远程仅支持 claude-code 的硬编码逻辑，恢复使用下面注释掉的获取逻辑
		const agentIdLabe =
			codeAgentState.type === "local"
				? agentIdLabelMap.get(codeAgentState.currentAgentId)
				: agentIdLabelMap.get("claude-code");
		// const agentIdLabe = agentIdLabelMap.get(codeAgentState.currentAgentId);

		return selectedMode === "chat"
			? m.title_chat_mode_description()
			: codeAgentState.type === "local"
				? m.title_local_mode_description({
						type: `<span class="text-primary">${m.title_local()}${agentIdLabe}</span>`,
					})
				: m.title_code_agent_description({
						type: `<span class="text-primary">${m.title_remote()}${agentIdLabe}</span>`,
					});
	});

	function handleModeSelect(key: string) {
		const isVibe = key === "vibe";
		onIsVibeChange(isVibe);
		codeAgentState.updateEnabled(isVibe);

		// 切换到聊天模式时，自动删除超出限制的附件（保留最新的）
		if (!isVibe && chatState.attachments.length > MAX_ATTACHMENT_COUNT) {
			const attachmentsToKeep = chatState.attachments.slice(-MAX_ATTACHMENT_COUNT);
			chatState.attachments = attachmentsToKeep;
		}

		if (!chatState.hasMessages) {
			if (isVibe) {
				if (preferencesSettings.vibeNewSessionModel) {
					chatState.selectedModel = preferencesSettings.vibeNewSessionModel;
				}
			} else {
				if (preferencesSettings.newSessionModel) {
					chatState.selectedModel = preferencesSettings.newSessionModel;
				}
			}
		}

		codeAgentState.updateType(codeAgentGlobalConfigsState.lastVibeMode);
		if (isVibe && codeAgentState.type === "local") {
			codeAgentState.updateCurrentAgentId(codeAgentGlobalConfigsState.lastAgentId);
		}
	}

	function handleSettingsClick() {
		if (codeAgentState.isChecking) return;
		codeAgentState.isCodeAgentPanelOpen = true;
	}

	function handleCodeAgentPanelClose() {
		codeAgentState.isCodeAgentPanelOpen = false;

		if (codeAgentState.isFreshTab && agentPreviewState.isVisible) {
			agentPreviewState.closePreview();
		}
	}
</script>

<div class="flex items-center justify-between px-3 pt-2">
	<div class="flex items-center gap-2">
		{#if !chatState.hasMessages}
			<SegButton
				options={modeOptions}
				selectedKey={selectedMode}
				onSelect={handleModeSelect}
				class="!h-8 w-[200px] !rounded-full p-1 bg-muted"
				thumbClass="!h-6 text-xs rounded-full"
				activeThumbClass="text-white"
				leftThumbClass="bg-primary"
				contentClass="gap-0"
				disabled={codeAgentState.isChecking}
			/>
		{:else}
			<Badge variant="secondary" class="bg-primary/20 text-primary font-light">
				{selectedMode === "vibe" ? m.title_code_agent() : m.title_chat_mode()}
			</Badge>
		{/if}

		{#if codeAgentState.enabled}
			<ButtonWithTooltip
				class="h-8 w-8 hover:!bg-chat-action-hover"
				tooltip={m.title_code_agent_settings()}
				onclick={handleSettingsClick}
				disabled={codeAgentState.isChecking}
			>
				<Settings class="size-4" />
			</ButtonWithTooltip>

			<Overlay
				title={m.title_code_agent_settings()}
				open={codeAgentState.isCodeAgentPanelOpen}
				onClose={handleCodeAgentPanelClose}
			>
				<CodeAgentPanel onClose={handleCodeAgentPanelClose} />
			</Overlay>
		{/if}
	</div>

	<div class="flex items-center gap-2">
		{#if isVibeLocal && chatState.hasMessages}
			<AgentClassToggle />
		{/if}
		{#if !chatState.hasMessages}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			<p class="text-xs text-muted-foreground">{@html description}</p>
		{/if}
	</div>
</div>
