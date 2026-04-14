<script lang="ts" module>
	export const platformOptions = [
		{
			key: "remote",
			label: m.platform_remote_label(),
			description: m.platform_remote_description(),
		},
		{
			key: "cloud",
			label: m.platform_cloud_label(),
			description: m.platform_cloud_description(),
		},
		{
			key: "local",
			label: m.platform_local_label(),
			description: m.platform_local_description(),
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

	import OpenClawChannelPanel from "$lib/components/buss/open-claw-config-panel/open-claw-channel-panel.svelte";
	import { cloudModeSessionsState } from "$lib/stores/code-agent/cloud-mode-sessions-state.svelte";
	import { match } from "ts-pattern";
	import { DEFAULT_WORKSPACE_PATH } from "../agent-preview/constants";
	import ClaudeCodePanel from "./claude-code-panel.svelte";
	import CloudModePanel from "./cloud-mode-panel.svelte";
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
				const currentSession = currentSandbox?.sessionInfos.find(
					(s) => s.sessionId === sessionId,
				);
				return currentSession?.note ?? currentSession?.sessionId ?? m.title_new_chat();
			})
			.with("local", () => {
				const sessionId = codeAgentState.currentSessionId;
				const currentSession = localClaudeCodeSandboxState.sessions.find(
					(s) => s.session_id === sessionId,
				);
				return currentSession?.note ?? currentSession?.session_id ?? m.title_new_chat();
			})
			.with("cloud", () => {
				const sessionId = codeAgentState.currentSessionId;
				const currentSession = cloudModeSessionsState.sessions.find(
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
			{:else if displayType === "local"}
				<LocalModePanel {onClose} />
			{:else if displayType === "cloud"}
				<CloudModePanel {onClose} />
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
							disabled={codeAgentState.isUpdatingSandboxRemark ||
								!isSandboxRemarkChanged}
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
					<!-- <OpenClawConfigPanel className="hidden" /> -->
					<OpenClawChannelPanel />
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
