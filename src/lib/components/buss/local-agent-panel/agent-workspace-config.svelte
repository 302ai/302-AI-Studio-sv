<script lang="ts">
	import { SegButton, SettingSelect } from "$lib/components/buss/settings";
	import {
		Accordion,
		AccordionContent,
		AccordionItem,
		AccordionTrigger,
	} from "$lib/components/ui/accordion";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentGlobalConfigsState, codeAgentState } from "$lib/stores/code-agent";
	import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { cn } from "$lib/utils";
	import { RefreshCcw } from "@lucide/svelte";
	import { agentClass } from "@shared/storage/code-agent";
	import { onMount } from "svelte";
	import { ButtonWithTooltip } from "../button-with-tooltip";
	import SettingInputField from "../settings/setting-input-field.svelte";

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
		<Accordion type="single" value="channel-settings" class="w-full">
			<AccordionItem value="channel-settings" class="border-b-0">
				<AccordionTrigger class="py-2 hover:no-underline">
					<Label class="text-label-fg font-normal no-underline hover:underline cursor-pointer"
						>{m.agent_framework_open_claw_set_channel()}</Label
					>
				</AccordionTrigger>
				<AccordionContent class="pt-2 space-y-2">
					<Accordion type="single" value="fei-shu" class="w-full rounded-settings-item">
						<AccordionItem value="fei-shu" class="border-b-0">
							<AccordionTrigger class="py-3 px-4 bg-input hover:no-underline">
								<Label class=" font-normal no-underline cursor-pointer"
									>{m.open_claw_channel_feishu()}</Label
								>
							</AccordionTrigger>
							<AccordionContent class="pt-2 space-y-2">
								<div class="rounded-lg border p-4 space-y-4">
									<!-- <div>
							<span class={cn("size-2 rounded-full", statusColorClass)}></span>
						</div> -->
									<!-- bind:value={tempAppid} -->
									<SettingInputField
										label={m.open_claw_appid()}
										placeholder={m.open_claw_placeholder_appid()}
										bind:value={codeAgentGlobalConfigsState.feishu.appId}
										class="[&>label]:text-label-fg"
									/>
									<!-- bind:value={tempAppSecret} -->
									<SettingInputField
										label={m.open_claw_app_secret()}
										placeholder={m.open_claw_placeholder_app_secret()}
										type="password"
										bind:value={codeAgentGlobalConfigsState.feishu.appSecret}
										class="[&>label]:text-label-fg"
									/>
									<div class="flex justify-start items-center">
										<a
											href="https://open.feishu.cn/app?lang=zh-CN"
											class="text-primary hover:opacity-50">点击此处获取ID和密钥</a
										>
										<div class="h-5 w-0.5 bg-gray-200 mx-1"></div>
										<a
											href="https://studio.302.ai/zh/docs/advanced/open-claw/feishu"
											class="text-primary hover:opacity-50">查看部署教程</a
										>
									</div>
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
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
