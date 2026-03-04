<script lang="ts">
	import type { ListSkillsResponse } from "$lib/api/skills/base-apis";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { McpServerSelector } from "$lib/components/buss/mcp-server-selector";
	import { Overlay } from "$lib/components/buss/overlay";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import { SkillList } from "$lib/components/buss/skill-list";
	import { Button, buttonVariants } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import * as Popover from "$lib/components/ui/popover";
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger,
	} from "$lib/components/ui/tooltip";
	import { m } from "$lib/paraglide/messages.js";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { mcpState } from "$lib/stores/mcp-state.svelte";
	import { quickPromptState } from "$lib/stores/quick-prompt-state.svelte";
	import { cn } from "$lib/utils";
	import mcpIcon from "@lobehub/icons-static-svg/icons/mcp.svg";
	import {
		ClipboardList,
		Globe,
		Lightbulb,
		ListTodo,
		Settings2,
		Sparkles,
		ToolCase,
		Zap,
	} from "@lucide/svelte";
	import type { ThinkingBudgetType } from "@shared/types";
	import type { Component } from "svelte";
	import { toast } from "svelte-sonner";
	import { AttachmentUploader } from "../attachment";
	import ParametersPanel from "./parameter/parameters-panel.svelte";

	const { addClaudeCodeSandboxMCP } = window.electronAPI.codeAgentService;

	interface Props {
		disabled?: boolean;
	}
	let { disabled = false }: Props = $props();

	let actionDisabled = $derived(chatState.providerType !== "302ai");

	let isMCPSelectorOpen = $state(false);
	let addingMCP = $state(false);

	let isThinkingBudgetOpen = $state(false);
	let skillsData = $state<Omit<ListSkillsResponse, "success" | "project_skills">>({
		builtin_skills: [],
		user_skills: [],
	});

	const thinkingBudgetOptions = $derived([
		{ key: "off", label: m.settings_off() },
		{ key: "low", label: m.thinking_strength_low() },
		{ key: "medium", label: m.thinking_strength_medium() },
		{ key: "high", label: m.thinking_strength_high() },
		{ key: "max", label: m.thinking_strength_max() },
	]);

	function handleParametersClose() {
		chatState.isParametersOpen = false;
	}

	function handleMCPClick() {
		isMCPSelectorOpen = true;
	}

	async function handleMCPServerConfirm(selectedIds: string[]) {
		if (selectedIds.length > 0 && codeAgentState.enabled) {
			const sandboxId = codeAgentState.sandboxId;
			if (sandboxId) {
				addingMCP = true;
				const infos = mcpState.getMCPInfosByIds(selectedIds);
				await addClaudeCodeSandboxMCP(sandboxId, infos, codeAgentState.type);
				addingMCP = false;
			}
		}

		chatState.handleMCPServerChange(selectedIds);
	}

	function handleSkillsPanelToggle() {
		// Open skills tab if not already on it
		if (agentPreviewState.activeTab !== "skills") {
			agentPreviewState.openSkillsTab();
		}
	}

	function handleTaskboardPanelToggle() {
		// Open taskboard tab if not already on it
		if (agentPreviewState.activeTab !== "taskboard") {
			agentPreviewState.openTaskboardTab();
		}
	}

	function handlePlanModeToggle() {
		if (codeAgentTaskboardState.taskboardStatus !== "idle") {
			toast.info(m.toast_stop_taskboard_first());
			return;
		}
		codeAgentState.updateInPlanMode(!codeAgentState.inPlanMode);
	}

	// For responsiveness
	let containerWidth = $state(0);
	const COLLAPSE_THRESHOLD = 260;
	let isCollapsed = $derived(containerWidth < COLLAPSE_THRESHOLD);

	// Determine if any tool is currently active
	let hasActiveTool = $derived.by(() => {
		if (codeAgentState.enabled) {
			return (
				codeAgentState.inPlanMode ||
				codeAgentState.skills.some((s) => s.forceUse) ||
				codeAgentState.thinkingBudget !== "off" ||
				chatState.isMCPActive
			);
		} else {
			return (
				(chatState.providerType === "302ai" &&
					(chatState.isOnlineSearchActive || chatState.isThinkingActive)) ||
				chatState.isMCPActive
			);
		}
	});
</script>

{#snippet menuButton(config: {
	icon: Component | string;
	label: string;
	active?: boolean;
	disabled?: boolean;
	onclick?: () => void;
	isImg?: boolean;
	loading?: boolean;
})}
	<button
		class={cn(
			"flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent",
			config.active && "bg-chat-action-active/10 text-chat-action-active-fg",
			(config.disabled || config.loading) && "cursor-not-allowed opacity-50",
		)}
		onclick={config.onclick}
		disabled={config.disabled || config.loading}
	>
		<div class="flex size-4 items-center justify-center shrink-0">
			{#if config.loading}
				<LdrsLoader type="line-spinner" size={14} />
			{:else if config.isImg}
				<img
					src={config.icon as string}
					alt={config.label}
					class={cn(
						"size-4 dark:invert",
						config.active &&
							"[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)]",
					)}
				/>
			{:else}
				{@const Icon = config.icon as Component}
				<Icon class={cn("size-4", config.active && "text-chat-action-active-fg")} />
			{/if}
		</div>
		<span class="truncate">{config.label}</span>
	</button>
{/snippet}

{#snippet actionEnableThinking(isMenu = false)}
	{#if isMenu}
		{@render menuButton({
			icon: Lightbulb,
			label: actionDisabled ? m.title_unsupport_action() : m.title_thinking(),
			active: chatState.isThinkingActive,
			disabled: disabled || actionDisabled,
			onclick: () => chatState.handleThinkingActiveChange(!chatState.isThinkingActive),
		})}
	{:else}
		<ButtonWithTooltip
			class={cn(
				"hover:!bg-chat-action-hover",
				chatState.isThinkingActive && "!bg-chat-action-active hover:!bg-chat-action-active",
			)}
			tooltip={actionDisabled ? m.title_unsupport_action() : m.title_thinking()}
			onclick={() => chatState.handleThinkingActiveChange(!chatState.isThinkingActive)}
			{disabled}
		>
			<Lightbulb class={cn(chatState.isThinkingActive && "!text-chat-action-active-fg")} />
		</ButtonWithTooltip>
	{/if}
{/snippet}

{#snippet actionEnableOnlineSearch(isMenu = false)}
	{#if isMenu}
		{@render menuButton({
			icon: Globe,
			label: actionDisabled ? m.title_unsupport_action() : m.title_online_search(),
			active: chatState.isOnlineSearchActive,
			disabled: disabled || actionDisabled,
			onclick: () => chatState.handleOnlineSearchActiveChange(!chatState.isOnlineSearchActive),
		})}
	{:else}
		<ButtonWithTooltip
			class={cn(
				"hover:!bg-chat-action-hover",
				chatState.isOnlineSearchActive && "!bg-chat-action-active hover:!bg-chat-action-active",
			)}
			tooltip={actionDisabled ? m.title_unsupport_action() : m.title_online_search()}
			onclick={() => chatState.handleOnlineSearchActiveChange(!chatState.isOnlineSearchActive)}
			{disabled}
		>
			<Globe class={cn(chatState.isOnlineSearchActive && "!text-chat-action-active-fg")} />
		</ButtonWithTooltip>
	{/if}
{/snippet}

{#snippet actionEnableMCP(isMenu = false)}
	{#if isMenu}
		{@render menuButton({
			icon: mcpIcon,
			isImg: true,
			label: m.title_mcpServers(),
			active: chatState.isMCPActive,
			disabled: disabled,
			loading: addingMCP,
			onclick: handleMCPClick,
		})}
	{:else}
		<ButtonWithTooltip
			class={cn(
				"hover:!bg-chat-action-hover",
				chatState.isMCPActive && "!bg-chat-action-active hover:!bg-chat-action-active",
			)}
			tooltip={m.title_mcpServers()}
			onclick={handleMCPClick}
			disabled={disabled || addingMCP}
		>
			{#if addingMCP}
				<LdrsLoader type="line-spinner" size={16} />
			{:else}
				<img
					src={mcpIcon}
					alt="MCP"
					class={cn(
						"size-chat-icon group-hover:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:invert",
						chatState.isMCPActive &&
							"[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)]",
					)}
				/>
			{/if}
		</ButtonWithTooltip>
	{/if}

	<McpServerSelector
		bind:open={isMCPSelectorOpen}
		selectedServerIds={chatState.mcpServerIds}
		onConfirm={handleMCPServerConfirm}
		filterType={codeAgentState.enabled ? "streamableHTTP" : undefined}
	/>
{/snippet}

{#snippet actionSetParameters(isMenu = false)}
	{#if isMenu}
		{@render menuButton({
			icon: Settings2,
			label: m.title_chat_parameters(),
			onclick: () => (chatState.isParametersOpen = true),
			disabled,
		})}
	{:else}
		<ButtonWithTooltip
			class="hover:!bg-chat-action-hover"
			tooltip={m.title_chat_parameters()}
			onclick={() => (chatState.isParametersOpen = true)}
			{disabled}
		>
			<Settings2 />
		</ButtonWithTooltip>
	{/if}

	<Overlay
		title={m.title_chat_parameters()}
		open={chatState.isParametersOpen}
		onClose={handleParametersClose}
	>
		<ParametersPanel />
	</Overlay>
{/snippet}

{#snippet actionUploadAttachment()}
	<div class="shrink-0">
		<AttachmentUploader {disabled} />
	</div>
{/snippet}

{#snippet actionOpenQuickPrompt(isMenu = false)}
	{#if isMenu}
		{@render menuButton({
			icon: Sparkles,
			label: m.quick_prompt_panel_title(),
			active: quickPromptState.isOpen,
			onclick: () => (quickPromptState.isOpen ? quickPromptState.close() : quickPromptState.open()),
			disabled,
		})}
	{:else}
		<ButtonWithTooltip
			class={cn(
				"hover:!bg-chat-action-hover",
				quickPromptState.isOpen && "!bg-chat-action-active hover:!bg-chat-action-active",
			)}
			tooltip={m.quick_prompt_panel_title()}
			onclick={() => (quickPromptState.isOpen ? quickPromptState.close() : quickPromptState.open())}
			{disabled}
		>
			<Sparkles class={cn(quickPromptState.isOpen && "!text-chat-action-active-fg")} />
		</ButtonWithTooltip>
	{/if}
{/snippet}

{#snippet actionEnableSkills(isMenu = false)}
	{@const hasForceUseSkills = codeAgentState.skills.some((s) => s.forceUse)}
	{#if isMenu}
		{@render menuButton({
			icon: Zap,
			label: m.title_skills(),
			active: hasForceUseSkills && !codeAgentState.isLoadingSkills,
			loading: codeAgentState.isLoadingSkills,
			disabled: codeAgentState.isChecking,
			onclick: handleSkillsPanelToggle,
		})}
	{:else}
		<ButtonWithTooltip
			class={cn(
				"hover:!bg-chat-action-hover",
				hasForceUseSkills &&
					!codeAgentState.isLoadingSkills &&
					"!bg-chat-action-active hover:!bg-chat-action-active",
			)}
			tooltip={m.title_skills()}
			onclick={handleSkillsPanelToggle}
			disabled={codeAgentState.isLoadingSkills || codeAgentState.isChecking}
		>
			{#if codeAgentState.isLoadingSkills}
				<LdrsLoader type="line-spinner" size={16} />
			{:else}
				<Zap class={cn(hasForceUseSkills && "!text-chat-action-active-fg")} />
			{/if}
		</ButtonWithTooltip>
	{/if}

	<Overlay
		title={m.title_skills_management()}
		open={codeAgentState.isSkillsPanelOpen}
		onClose={handleSkillsPanelToggle}
		class="h-[70vh] w-[80vw] max-w-5xl flex flex-col"
	>
		<div class="flex-1 overflow-y-auto min-h-0 px-6 pb-6">
			<SkillList
				builtinSkills={skillsData.builtin_skills}
				userSkills={skillsData.user_skills}
				loading={codeAgentState.isLoadingSkills}
				usedSkills={codeAgentState.skills}
				onUse={(skill) => codeAgentState.handleSkillsUse([skill])}
				onRemove={(skill) => codeAgentState.handleSkillsRemove([skill])}
				onForceUseToggle={(skill, forceUse) =>
					codeAgentState.handleSkillForceUseToggle(skill.name, forceUse)}
			/>
		</div>
	</Overlay>
{/snippet}

{#snippet actionEnabledAgentThinking(isMenu = false)}
	<Popover.Root bind:open={isThinkingBudgetOpen}>
		{#if isMenu}
			<Popover.Trigger class="w-full">
				{#snippet child({ props: popoverProps })}
					<button
						{...popoverProps}
						class={cn(
							"flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent",
							codeAgentState.thinkingBudget !== "off" &&
								"bg-chat-action-active/10 text-chat-action-active-fg",
							(disabled || codeAgentState.isUpdatingThinkingBudget || codeAgentState.isChecking) &&
								"cursor-not-allowed opacity-50",
						)}
						disabled={disabled ||
							codeAgentState.isUpdatingThinkingBudget ||
							codeAgentState.isChecking}
					>
						<div class="flex size-4 items-center justify-center shrink-0">
							{#if codeAgentState.isUpdatingThinkingBudget}
								<LdrsLoader type="line-spinner" size={14} />
							{:else}
								<Lightbulb
									class={cn(
										"size-4",
										codeAgentState.thinkingBudget !== "off" && "text-chat-action-active-fg",
									)}
								/>
							{/if}
						</div>
						<span class="truncate">
							{actionDisabled ? m.title_unsupport_action() : m.title_thinking()}
						</span>
					</button>
				{/snippet}
			</Popover.Trigger>
		{:else}
			<TooltipProvider delayDuration={500}>
				<Tooltip ignoreNonKeyboardFocus={true}>
					<TooltipTrigger>
						{#snippet child({ props: tooltipProps })}
							<Popover.Trigger>
								{#snippet child({ props: popoverProps })}
									<button
										{...tooltipProps}
										{...popoverProps}
										class={cn(
											buttonVariants({ variant: "ghost", size: "icon" }),
											"group rounded-[10px]",
											"hover:!bg-chat-action-hover",
											codeAgentState.thinkingBudget !== "off" &&
												"!bg-chat-action-active hover:!bg-chat-action-active",
										)}
										disabled={disabled ||
											codeAgentState.isUpdatingThinkingBudget ||
											codeAgentState.isChecking}
									>
										{#if codeAgentState.isUpdatingThinkingBudget}
											<LdrsLoader type="line-spinner" size={16} />
										{:else}
											<Lightbulb
												class={cn(
													codeAgentState.thinkingBudget !== "off" && "!text-chat-action-active-fg",
												)}
											/>
										{/if}
									</button>
								{/snippet}
							</Popover.Trigger>
						{/snippet}
					</TooltipTrigger>
					<TooltipContent
						side="top"
						class="bg-overlay text-overlay-foreground rounded-[10px] border px-2.5 py-1.5 text-sm/6"
						arrowClasses="hidden"
						sideOffset={5}
					>
						{actionDisabled ? m.title_unsupport_action() : m.title_thinking()}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		{/if}

		<Popover.Content class="w-[400px] p-4" align="center" side="bottom" sideOffset={10}>
			<div class="flex flex-col gap-2">
				<div class="flex flex-col gap-2">
					<Label class="text-label-fg">{m.title_thinking_strength()}</Label>
					<div class="text-muted-foreground text-xs">{m.description_thinking_strength()}</div>
				</div>
				<SegButton
					options={thinkingBudgetOptions}
					selectedKey={codeAgentState.thinkingBudget}
					onSelect={(key) => codeAgentState.updateThinkingBudget(key as ThinkingBudgetType)}
					disabled={codeAgentState.isUpdatingThinkingBudget}
				/>
			</div>
		</Popover.Content>
	</Popover.Root>
{/snippet}

{#snippet actionTaskOrchestration(isMenu = false)}
	{#if isMenu}
		{@render menuButton({
			icon: ListTodo,
			label: m.label_tab_taskboard(),
			disabled: disabled || codeAgentState.isChecking,
			onclick: handleTaskboardPanelToggle,
		})}
	{:else}
		<ButtonWithTooltip
			class="hover:!bg-chat-action-hover"
			tooltip={m.label_tab_taskboard()}
			onclick={handleTaskboardPanelToggle}
			disabled={disabled || codeAgentState.isChecking}
		>
			<ListTodo />
		</ButtonWithTooltip>
	{/if}
{/snippet}

{#snippet actionEnablePlanMode(isMenu = false)}
	{#if isMenu}
		{@render menuButton({
			icon: ClipboardList,
			label: m.title_plan_mode(),
			active: codeAgentState.inPlanMode,
			disabled: disabled,
			onclick: handlePlanModeToggle,
		})}
	{:else}
		<ButtonWithTooltip
			class={cn(
				"hover:!bg-chat-action-hover",
				codeAgentState.inPlanMode && "!bg-chat-action-active hover:!bg-chat-action-active",
			)}
			tooltip={m.title_plan_mode()}
			onclick={handlePlanModeToggle}
			{disabled}
		>
			<ClipboardList class={cn(codeAgentState.inPlanMode && "!text-chat-action-active-fg")} />
		</ButtonWithTooltip>
	{/if}
{/snippet}

{#snippet actionToolCase()}
	<Popover.Root>
		<Popover.Trigger class="shrink-0">
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					class={cn(
						"flex items-center gap-1.5 rounded-[10px] px-2.5 text-sm text-foreground/70 hover:!bg-chat-action-hover",
						hasActiveTool &&
							"!bg-chat-action-active hover:!bg-chat-action-active !text-chat-action-active-fg",
					)}
				>
					<ToolCase class={cn("size-4", hasActiveTool && "!text-chat-action-active-fg")} />
					<span>{m.mcp_tools()}</span>
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-52 p-1.5" align="start" side="top" sideOffset={10}>
			<div class="flex flex-col gap-0.5">
				{#if !codeAgentState.enabled}
					{@render actionOpenQuickPrompt(true)}
				{/if}

				{#if !codeAgentState.enabled && chatState.providerType === "302ai"}
					{@render actionEnableOnlineSearch(true)}
					{@render actionEnableThinking(true)}
				{/if}

				{#if codeAgentState.currentAgentId !== "open-claw"}
					{@render actionEnableMCP(true)}
				{/if}

				{#if codeAgentState.enabled && codeAgentState.currentAgentId !== "open-claw"}
					{@render actionEnablePlanMode(true)}
					{@render actionEnableSkills(true)}
					{@render actionEnabledAgentThinking(true)}
					{@render actionTaskOrchestration(true)}
				{:else if !codeAgentState.enabled}
					{@render actionSetParameters(true)}
				{/if}
			</div>
		</Popover.Content>
	</Popover.Root>
{/snippet}

<div
	class="flex h-chat-bar min-w-0 w-full items-center gap-chat-bar-gap overflow-hidden"
	bind:clientWidth={containerWidth}
>
	{@render actionUploadAttachment()}

	{#if isCollapsed && !(codeAgentState.enabled && codeAgentState.currentAgentId === "open-claw")}
		{@render actionToolCase()}
	{:else}
		<div class="flex items-center gap-chat-bar-gap shrink-0">
			{#if !codeAgentState.enabled}
				{@render actionOpenQuickPrompt()}
			{/if}

			{#if !codeAgentState.enabled && chatState.providerType === "302ai"}
				{@render actionEnableOnlineSearch()}
				{@render actionEnableThinking()}
			{/if}

			{#if codeAgentState.currentAgentId !== "open-claw"}
				{@render actionEnableMCP()}
			{/if}

			{#if codeAgentState.enabled && codeAgentState.currentAgentId !== "open-claw"}
				{@render actionEnablePlanMode()}
				{@render actionEnableSkills()}
				{@render actionEnabledAgentThinking()}
				{@render actionTaskOrchestration()}
			{:else if !codeAgentState.enabled}
				{@render actionSetParameters()}
			{/if}
		</div>
	{/if}
</div>
