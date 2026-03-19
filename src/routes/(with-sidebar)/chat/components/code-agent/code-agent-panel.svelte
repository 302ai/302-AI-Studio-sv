<script lang="ts" module>
	export const platformOptions = [
		{
			key: "remote",
			label: m.title_remote(),
			description: m.title_remote_platform_description(),
		},
		{
			key: "local",
			label: m.title_local(),
			description: m.title_local_platform_description(),
		},
	];
	export const options: SelectOption[] = [
		{
			key: "claude-code",
			label: m.agent_framework_claude_code_label(),
			value: "claude-code",
		},
		// {
		// 	key: "open-claw",
		// 	label: m.agent_framework_open_claw_label(),
		// 	value: "open-claw",
		// },
	];

	export interface Props {
		onClose: () => void;
	}
</script>

<script lang="ts">
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import PodmanCard from "$lib/components/buss/local-agent-panel/podman-card.svelte";
	import SandboxCard from "$lib/components/buss/local-agent-panel/sandbox-card.svelte";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import type { SelectOption } from "$lib/components/buss/settings/setting-select.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { persistedClaudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import {
		codeAgentState,
		persistedCodeAgentConfigState,
	} from "$lib/stores/code-agent/code-agent-state.svelte";
	import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { type CodeAgentType } from "@shared/storage/code-agent";

	import OpenClawConfigPanel from "$lib/components/buss/open-claw-config-panel/open-claw-config-panel.svelte";
	import SettingInputField from "$lib/components/buss/settings/setting-input-field.svelte";
	import {
		Accordion,
		AccordionContent,
		AccordionItem,
		AccordionTrigger,
	} from "$lib/components/ui/accordion";
	import { RefreshCw } from "@lucide/svelte";
	import { match } from "ts-pattern";
	import { DEFAULT_WORKSPACE_PATH } from "../agent-preview/constants";
	import ClaudeCodePanel from "./claude-code-panel.svelte";
	import LocalModePanel from "./local-mode-panel.svelte";

	let { onClose }: Props = $props();

	let disabled = $derived(!codeAgentState.isFreshTab);
	let displayType = $derived(persistedCodeAgentConfigState.current?.type ?? "remote");
	let tempSandboxRemark = $state("");
	let tempSessionRemark = $state("");

	let currentSandboxRemark = $derived.by(() => {
		const sandboxId = codeAgentState.sandboxId;
		const currentSandbox = persistedClaudeCodeSandboxState.current.find(
			(s) => s.sandboxId === sandboxId,
		);
		return currentSandbox?.sandboxRemark || currentSandbox?.sandboxId || sandboxId || "";
	});

	let currentSessionRemark = $derived.by(() => {
		return match(codeAgentState.type)
			.with("remote", () => {
				const sandboxId = codeAgentState.sandboxId;
				const sessionId = codeAgentState.currentSessionId;
				const currentSandbox = persistedClaudeCodeSandboxState.current.find(
					(s) => s.sandboxId === sandboxId,
				);
				const currentSession = currentSandbox?.sessionInfos.find((s) => s.sessionId === sessionId);
				return currentSession?.note ?? currentSession?.sessionId ?? m.title_new_chat();
			})
			.with("local", () => {
				const sessionId = codeAgentState.currentSessionId;
				const currentSession = localClaudeCodeSandboxState.sessions.find(
					(s) => s.session_id === sessionId,
				);
				return currentSession?.note ?? currentSession?.session_id ?? m.title_new_chat();
			})
			.exhaustive();
	});

	let isSandboxRemarkChanged = $derived(tempSandboxRemark !== currentSandboxRemark);
	let isSessionRemarkChanged = $derived(tempSessionRemark !== currentSessionRemark);

	$effect(() => {
		if (
			codeAgentState.inCodeAgentMode &&
			(codeAgentState.currentAgentId === "claude-code" ||
				codeAgentState.currentAgentId === "open-claw")
		) {
			tempSandboxRemark = currentSandboxRemark;

			tempSessionRemark = currentSessionRemark;
		}
	});
	async function handleSelect(key: string) {
		codeAgentState.updateType(key as CodeAgentType);
	}

	async function handleUpdateSandboxRemark() {
		if (!tempSandboxRemark || !isSandboxRemarkChanged) return;
		await codeAgentState.updateSandboxRemark(tempSandboxRemark);
	}

	async function handleUpdateSessionRemark() {
		if (!tempSessionRemark || !isSessionRemarkChanged) return;
		await codeAgentState.updateSessionRemark(tempSessionRemark);
	}

	async function handleInstall() {
		await localEnvState.installPodman();
	}

	async function handleOpenWorkspace() {
		const path = codeAgentState.currentWorkspacePath;
		if (!path) return;

		// Remove workspace prefix if present to get path relative to workspace root
		let relativePath = path;
		if (relativePath.startsWith(DEFAULT_WORKSPACE_PATH)) {
			relativePath = relativePath.slice(DEFAULT_WORKSPACE_PATH.length);
		}

		// Remove leading slash if present to ensure relative path
		relativePath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
		await window.electronAPI.localVibeService.openWorkspaceDirectory(relativePath);
	}
</script>

{#snippet initializePanel()}
	<div class="w-[600px] max-h-[500px] overflow-y-auto">
		<div class="flex flex-col gap-y-4 rounded-[10px] bg-background p-4">
			<div class="gap-settings-gap flex flex-col">
				<Label class="mb-2 text-label-fg">{m.title_code_agent_type()}</Label>
				<SegButton
					options={platformOptions}
					selectedKey={displayType}
					onSelect={handleSelect}
					{disabled}
					class="!h-[52px]"
					thumbClass="!h-[40px]"
				/>
			</div>

			{#if displayType === "remote"}
				<ClaudeCodePanel {onClose} />
			{/if}
			{#if displayType === "local"}
				<!-- max-h-[500px] overflow-y-auto -->
				<div class="pr-2">
					<LocalModePanel {onClose} />
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet configurationPanel()}
	<div class="w-[500px]">
		<div
			class="flex flex-col gap-y-4 rounded-[10px] bg-background p-4 max-h-[500px] overflow-y-auto"
		>
			{#if codeAgentState.type === "local"}
				<div class="rounded-lg border p-4 space-y-4">
					<PodmanCard isOpen={false} onInstall={handleInstall} />
					<SandboxCard isOpen={false} />
				</div>
			{/if}

			{#if codeAgentState.type === "remote"}
				<div class="gap-settings-gap flex flex-col">
					<Label class="text-label-fg">{m.title_sandbox_remark()}</Label>
					<div class="flex flex-row gap-2">
						<Input
							class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
							bind:value={tempSandboxRemark}
							placeholder={m.placeholder_input_sandbox_remark()}
						/>
						<Button
							variant="outline"
							class="h-10 shrink-0"
							disabled={codeAgentState.isUpdatingSandboxRemark || !isSandboxRemarkChanged}
							onclick={handleUpdateSandboxRemark}
						>
							{#if codeAgentState.isUpdatingSandboxRemark}
								<LdrsLoader type="line-spinner" size={16} />
							{:else}
								{m.text_button_save()}
							{/if}
						</Button>
					</div>
				</div>
			{/if}

			<div class="gap-settings-gap flex flex-col">
				<Label class="text-label-fg">{m.label_session_remark()}</Label>
				<div class="flex flex-row gap-2">
					<Input
						class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
						bind:value={tempSessionRemark}
						placeholder={m.placeholder_input()}
					/>
					<Button
						variant="outline"
						class="h-10 shrink-0"
						disabled={codeAgentState.isUpdatingSessionRemark || !isSessionRemarkChanged}
						onclick={handleUpdateSessionRemark}
					>
						{#if codeAgentState.isUpdatingSessionRemark}
							<LdrsLoader type="line-spinner" size={16} />
						{:else}
							{m.text_button_save()}
						{/if}
					</Button>
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
								<Accordion type="single" class="w-full rounded-settings-item">
									<AccordionItem value="fei-shu" class="border-b-0">
										<AccordionTrigger class="py-3.5 px-4 bg-input hover:no-underline">
											<Label class=" font-normal no-underline cursor-pointer">飞书会话ID</Label>
										</AccordionTrigger>
										<AccordionContent class="pb-0 pt-2 space-y-2">
											<div class="rounded-lg border p-4 space-y-4">
												<!-- <div>
								<span class={cn("size-2 rounded-full", statusColorClass)}></span>
								</div> -->
												<!-- bind:value={tempAppid} -->
												<SettingInputField
													label="会话id"
													placeholder="请输入会话id"
													class="[&>label]:text-label-fg"
												/>
												<!-- bind:value={tempAppSecret} -->
												<div class="flex items-center justify-between">
													<div class=" text-muted-foreground flex items-center gap-2 text-xs">
														<a
															href="https://open.feishu.cn/app?lang=zh-CN"
															class="text-primary hover:underline"
															>{m.open_claw_feishu_get_id_and_secret()}</a
														>
														<div class="text-muted-foreground/50">|</div>
														<a
															href="https://studio.302.ai/zh/docs/advanced/open-claw/feishu"
															class="text-primary hover:underline"
															>{m.open_claw_feishu_view_deployment_tutorial()}</a
														>
													</div>
												</div>
											</div>
										</AccordionContent>
									</AccordionItem>
								</Accordion>

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
			</div>

			{#if codeAgentState.type === "local" && !codeAgentState.isFreshTab}
				<div class="flex flex-row items-center gap-4">
					<Label class="text-label-fg">{m.local_platform_work_directory()}</Label>
					<button
						class="text-sm hover:underline cursor-pointer focus:outline-none text-left break-all text-primary"
						onclick={handleOpenWorkspace}
					>
						{codeAgentState.currentWorkspacePath}
					</button>
				</div>
			{/if}

			<div class="flex flex-row justify-between">
				<Button variant="secondary" onclick={onClose}>
					{m.common_cancel()}
				</Button>
				<Button onclick={onClose}>
					{m.label_button_confirm()}
				</Button>
			</div>
		</div>
	</div>
{/snippet}

{#if codeAgentState.inCodeAgentMode}
	{@render configurationPanel()}
{:else}
	{@render initializePanel()}
{/if}
