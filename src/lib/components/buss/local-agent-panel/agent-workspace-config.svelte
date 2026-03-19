<script lang="ts">
	import { SegButton, SettingSelect } from "$lib/components/buss/settings";
	import SettingInputField from "$lib/components/buss/settings/setting-input-field.svelte";
	import {
		Accordion,
		AccordionContent,
		AccordionItem,
		AccordionTrigger,
	} from "$lib/components/ui/accordion";
	import { Button } from "$lib/components/ui/button";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent";
	import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { cn } from "$lib/utils";
	import { RefreshCcw, RefreshCw } from "@lucide/svelte";
	import { agentClass } from "@shared/storage/code-agent";
	import { onMount } from "svelte";
	import { ButtonWithTooltip } from "../button-with-tooltip";
	import OpenClawConfigPanel from "../open-claw-config-panel/open-claw-config-panel.svelte";

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

{#snippet feishu()}
	<Accordion type="single" class="w-full rounded-settings-item">
		<AccordionItem value="fei-shu" class="border-b-0">
			<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
				<Label class=" font-normal no-underline cursor-pointer">飞书会话ID</Label>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<SettingInputField
						label="会话id"
						placeholder="请输入会话id"
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<div class="flex items-center justify-between">
						<div class=" text-muted-foreground flex items-center gap-2 text-xs">
							<a href="https://open.feishu.cn/app?lang=zh-CN" class="text-primary hover:underline"
								>点击此处获取会话id</a
							>
							<!-- <div class="text-muted-foreground/50">|</div>
											<a
												href="https://studio.302.ai/zh/docs/advanced/open-claw/feishu"
												class="text-primary hover:underline"
												>{m.open_claw_feishu_view_deployment_tutorial()}</a
											> -->
						</div>
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
{/snippet}

{#snippet telegram()}
	<Accordion type="single" class="w-full rounded-settings-item">
		<AccordionItem value="fei-shu" class="border-b-0">
			<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
				<Label class=" font-normal no-underline cursor-pointer">Telegram会话ID</Label>
			</AccordionTrigger>
			<AccordionContent class="pb-0 pt-2 space-y-2">
				<div class="rounded-lg border p-4 space-y-4">
					<SettingInputField
						label="会话id"
						placeholder="请输入会话id"
						class="[&>label]:text-label-fg"
					/>
					<!-- bind:value={tempAppSecret} -->
					<div class="flex items-center justify-between">
						<div class=" text-muted-foreground flex items-center gap-2 text-xs">
							<a href="https://open.feishu.cn/app?lang=zh-CN" class="text-primary hover:underline"
								>点击此处获取会话id</a
							>
							<!-- <div class="text-muted-foreground/50">|</div>
											<a
												href="https://studio.302.ai/zh/docs/advanced/open-claw/feishu"
												class="text-primary hover:underline"
												>{m.open_claw_feishu_view_deployment_tutorial()}</a
											> -->
						</div>
					</div>
				</div>
			</AccordionContent>
		</AccordionItem>
	</Accordion>
{/snippet}

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
		<OpenClawConfigPanel className="hidden" />
		<Accordion type="single" value="channel-settings" class="w-full m-0 ">
			<AccordionItem value="channel-settings" class="border-b-0">
				<AccordionTrigger class="py-2 hover:no-underline">
					<Label class="text-label-fg cursor-pointer"
						>{m.agent_framework_open_claw_set_channel()}</Label
					>
				</AccordionTrigger>
				<AccordionContent class="pb-1 pt-0 space-y-2">
					{@render feishu()}
					{@render telegram()}
					<div class="flex flex-col items-end">
						<Button class="w-fit">
							<RefreshCw class="size-4" />
							{m.open_claw_update_config()}
						</Button>
					</div>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
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
