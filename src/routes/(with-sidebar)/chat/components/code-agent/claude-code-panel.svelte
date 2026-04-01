<script lang="ts" module>
	export interface Props {
		onClose: () => void;
	}
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { SegButton } from "$lib/components/buss/settings";
	import { onMount } from "svelte";

	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";

	import { Button, buttonVariants } from "$lib/components/ui/button";
	import * as Collapsible from "$lib/components/ui/collapsible/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Field from "$lib/components/ui/field/index.js";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { cn } from "$lib/utils";
	import { ChevronsUpDownIcon, RefreshCcw } from "@lucide/svelte";

	const { windowService } = window.electronAPI;

	let { onClose }: Props = $props();

	onMount(() => {
		codeAgentState.init();
	});

	let disabled = $derived(!codeAgentState.isFreshTab);

	let isRefreshing = $state(false);
	let isCreateSandboxDialogOpen = $state(false);
	let isCreatingSandbox = $state(false);

	const agentFrameworkOptions = [
		{
			key: "claude-code",
			label: m.agent_framework_claude_code_label(),
			description: m.agent_framework_claude_code_description(),
		},
	];

	async function handleRefresh() {
		isRefreshing = true;
		await claudeCodeSandboxState.refreshSandboxes();
		isRefreshing = false;
	}

	async function handleCreateSandbox() {
		isCreatingSandbox = true;
		const isOK = await codeAgentState.handleCreateNewSandbox();
		if (isOK) {
			isCreateSandboxDialogOpen = false;
		}
		isCreatingSandbox = false;
	}

	async function handleOverlayAction(type: "enabled" | "disabled" | "cancel" | "close") {
		if (type === "enabled") {
			codeAgentState.updateEnabled(true, false);
		} else if (type === "close") {
			codeAgentState.updateEnabled(false, false);
		}

		onClose();
	}

	function handleCodeAgentEnabled() {
		codeAgentState.handleConfirmEnabled();

		handleOverlayAction("enabled");
	}

	function handleAgentFrameworkSelect(_: string) {
		// 远程模式下只支持 claude-code，open-claw 已被禁用
		// 此函数为空实现，仅满足 SegButton 的 onSelect 要求
	}
</script>

{#snippet selectSession()}
	<div class="gap-settings-gap flex flex-col">
		<div class="flex flex-row gap-2 items-center justify-between">
			<Label class="text-label-fg">{m.title_select_session()}</Label>
			<ButtonWithTooltip
				class="hover:!bg-chat-action-hover"
				tooltip={m.label_button_reload()}
				onclick={() => handleRefresh()}
				disabled={isRefreshing}
			>
				<RefreshCcw class={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
			</ButtonWithTooltip>
		</div>
		<SettingSelect
			name="session"
			value={codeAgentState.selectedSessionId}
			groupedOptions={claudeCodeSandboxState.groupedSessions}
			placeholder={m.select_session_placeholder()}
			{disabled}
			contentClass="w-[var(--bits-select-anchor-width)]"
			onValueChange={(v) => claudeCodeSandboxState.handleSessionSelected(v)}
		/>
	</div>
{/snippet}

{#snippet selectSandbox()}
	<div class="gap-settings-gap flex flex-col">
		<div class="flex flex-row gap-2 items-center justify-between">
			<Label class="text-label-fg text-xs">{m.title_select_sandbox()}</Label>

			<Dialog.Root bind:open={isCreateSandboxDialogOpen}>
				<Dialog.Trigger
					class={buttonVariants({
						variant: "ghost",
						class: "text-primary text-xs hover:!text-primary hover:!bg-chat-action-hover/50 h-8",
					})}
				>
					{m.label_button_create()}
				</Dialog.Trigger>
				<Dialog.Content class="!min-w-[600px]">
					<Dialog.Header>
						<Dialog.Title>{m.title_create_sandbox()}</Dialog.Title>
					</Dialog.Header>
					<Label class="text-label-fg">{m.title_sandbox_id()}</Label>
					<Input
						class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
						bind:value={codeAgentState.customSandboxName}
						placeholder={m.placeholder_input_sandbox_remark()}
					/>

					<Dialog.Footer class="flex flex-row items-center sm:justify-between">
						<Button
							variant="secondary"
							onclick={() => (isCreateSandboxDialogOpen = false)}
						>
							{m.common_cancel()}
						</Button>
						<Button
							variant="default"
							disabled={isCreatingSandbox}
							onclick={handleCreateSandbox}
						>
							{#if isCreatingSandbox}
								<LdrsLoader type="line-spinner" size={16} />
								{m.sandbox_creating()}
							{:else}
								{m.label_button_confirm()}
							{/if}
						</Button>
					</Dialog.Footer>
				</Dialog.Content>
			</Dialog.Root>
		</div>
		<SettingSelect
			name="sandbox"
			value={codeAgentState.selectedSandboxId}
			options={claudeCodeSandboxState.sandboxes}
			placeholder={m.select_sandbox_placeholder()}
			onValueChange={(v) => claudeCodeSandboxState.handleSelectSandbox(v)}
			disabled={disabled || isRefreshing}
			class="!bg-background dark:!bg-background"
			contentClass="w-[var(--bits-select-anchor-width)]"
		/>
	</div>
{/snippet}

{#snippet selectWorkspacePath()}
	<div class="gap-settings-gap flex flex-col">
		<Label class="text-label-fg text-xs">{m.local_platform_work_directory()}</Label>
		<SettingSelect
			name="workspacePath"
			value={codeAgentState.selectedWorkspacePath}
			groupedOptions={claudeCodeSandboxState.workspacePathOptions}
			placeholder={m.local_platform_new_work_directory_placeholder()}
			onValueChange={(v) => claudeCodeSandboxState.handleWorkspaceSelected(v)}
			disabled={disabled || isRefreshing}
			class="!bg-background dark:!bg-background"
			contentClass="w-[var(--bits-select-anchor-width)]"
		/>
	</div>
{/snippet}

{#snippet advancedSettings()}
	<Collapsible.Root
		class="!bg-settings-item-bg dark:!bg-settings-item-bg rounded-[10px] px-4 py-2"
	>
		<div class="flex flex-row items-center justify-between">
			<Label class="text-label-fg">{m.title_advanced_settings()}</Label>
			<Collapsible.Trigger
				class={buttonVariants({
					variant: "ghost",
					size: "icon",
					class: "hover:!bg-chat-action-hover rounded-[10px]",
				})}
			>
				<ChevronsUpDownIcon class="h-4 w-4" />
			</Collapsible.Trigger>
		</div>

		<Collapsible.Content class="pb-2">
			<div class="flex flex-col gap-2">
				{@render selectSandbox()}
				{@render selectWorkspacePath()}

				<Field.Description class="text-sm">
					{m.description_advanced_settings()}
					{m.click_here_manage_sandbox()}
					<button
						type="button"
						class="text-primary hover:underline hover:underline-offset-2 cursor-pointer"
						onclick={() => {
							windowService.handleOpenSettingsWindow("/settings/agent-settings");
						}}
						>{m.link_manage_sandbox()}
					</button>
				</Field.Description>
			</div>
		</Collapsible.Content>
	</Collapsible.Root>
{/snippet}

{#snippet panelFooter()}
	<div class="flex flex-row justify-between">
		<Button variant="secondary" onclick={() => handleOverlayAction("cancel")}>
			{m.common_cancel()}
		</Button>
		<Button disabled={codeAgentState.inCodeAgentMode} onclick={handleCodeAgentEnabled}>
			{m.label_button_confirm()}
		</Button>
	</div>
{/snippet}

<!-- Agent Framework Selection -->
<div class="space-y-2">
	<Label class="text-label-fg font-normal">{m.title_agent()}</Label>
	<SegButton
		class="!h-[52px]"
		thumbClass="!h-[40px]"
		options={agentFrameworkOptions}
		selectedKey="claude-code"
		onSelect={handleAgentFrameworkSelect}
	/>
</div>

{@render selectSession()}
{@render advancedSettings()}
{@render panelFooter()}
