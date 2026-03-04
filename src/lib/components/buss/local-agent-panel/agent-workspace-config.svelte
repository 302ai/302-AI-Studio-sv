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
	const channelOptions = [{ value: "fei-shu", label: m.open_claw_channel_feishu() }];
	let tempAppid = $state("");
	let tempAppSecret = $state("");
	let isSyncingFromState = $state(false);
	let hasLocalSynced = $state(false);

	function syncCredentialsToLocal() {
		isSyncingFromState = true;
		tempAppid = codeAgentGlobalConfigsState.currentCredentials.appid;
		tempAppSecret = codeAgentGlobalConfigsState.currentCredentials.appSecret;
		queueMicrotask(() => {
			isSyncingFromState = false;
		});
	}

	// TODO: optimize code
	$effect(() => {
		if (!codeAgentGlobalConfigsState.isHydrated || !hasLocalSynced || isSyncingFromState) {
			return;
		}
		if (tempAppid !== codeAgentGlobalConfigsState.currentCredentials.appid) {
			codeAgentGlobalConfigsState.updateOpenClawCurrentChannelAppId(tempAppid);
		}
	});

	$effect(() => {
		if (!codeAgentGlobalConfigsState.isHydrated || !hasLocalSynced || isSyncingFromState) {
			return;
		}
		if (tempAppSecret !== codeAgentGlobalConfigsState.currentCredentials.appSecret) {
			codeAgentGlobalConfigsState.updateOpenClawCurrentChannelAppSecret(tempAppSecret);
		}
	});

	$effect(() => {
		if (!codeAgentGlobalConfigsState.isHydrated) {
			return;
		}
		hasLocalSynced = false;
		syncCredentialsToLocal();
		hasLocalSynced = true;
	});

	async function handleRefresh() {
		await localClaudeCodeSandboxState.refreshSessions();
	}

	function handleCodeAgentSelected(codeAgentId: string) {
		if (agentClass.allows(codeAgentId)) {
			codeAgentState.updateCurrentAgentId(codeAgentId);
		}
	}

	function handleOpenClawChannelChange(value: string) {
		hasLocalSynced = false;
		codeAgentGlobalConfigsState.updateOpenClawCurrentChannel(
			value as typeof codeAgentGlobalConfigsState.currentChannel,
		);
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
			options={frameworkOptions}
			selectedKey={codeAgentState.currentAgentId}
			onSelect={handleCodeAgentSelected}
		/>
	</div>

	{#if codeAgentState.currentAgentId == "open-claw"}
		<Accordion type="single" value="channel-settings" class="w-full">
			<AccordionItem value="channel-settings" class="border-b-0">
				<AccordionTrigger class="py-2">
					<Label class="text-label-fg font-normal no-underline hover:underline cursor-pointer"
						>{m.agent_framework_open_claw_set_channel()}</Label
					>
				</AccordionTrigger>
				<AccordionContent class="pt-2 space-y-2">
					<SettingSelect
						name="Channel"
						value={codeAgentGlobalConfigsState.currentChannel}
						options={channelOptions}
						onValueChange={handleOpenClawChannelChange}
					/>
					<div class="rounded-lg border p-4 space-y-4">
						<!-- <div>
							<span class={cn("size-2 rounded-full", statusColorClass)}></span>
						</div> -->
						<SettingInputField
							label={m.open_claw_appid()}
							placeholder={m.open_claw_placeholder_appid()}
							bind:value={tempAppid}
							required={true}
						/>
						<SettingInputField
							label={m.open_claw_app_secret()}
							placeholder={m.open_claw_placeholder_app_secret()}
							bind:value={tempAppSecret}
							required={true}
							type="password"
						/>
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
