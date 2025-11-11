<script lang="ts">
	import ButtonWithTooltip from "$lib/components/buss/button-with-tooltip/button-with-tooltip.svelte";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import type { SelectOption } from "$lib/components/buss/settings/setting-select.svelte";
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { Input } from "$lib/components/ui/input";
	import Label from "$lib/components/ui/label/label.svelte";

	import { m } from "$lib/paraglide/messages";
	import { claudeCodeAgentState, codeAgentState } from "$lib/stores/code-agent";
	import { cn } from "$lib/utils";
	import { Plus, RefreshCcw } from "@lucide/svelte";

	let selectedKey = $derived(codeAgentState.type);
	// let isCreatingSandbox = $state(false);
	let showCustomSessionIdInput = $state(false);
	let customSessionId = $state("");

	const platformOptions = [
		{
			key: "remote",
			label: m.title_remote(),
		},
		{
			key: "local",
			label: m.title_local(),
		},
	];
	const options: SelectOption[] = [
		{
			key: "claude-code",
			label: "Claude Code",
			value: "claude-code",
		},
	];

	async function handleSelect(key: string) {
		codeAgentState.updateState({ type: key as "local" | "remote" });
	}

	// async function handleCreateSandbox(agentId: string) {
	// 	isCreatingSandbox = true;
	// 	let status: "success" | "failed" | "already-exist";
	// 	switch (agentId) {
	// 		case "claude-code":
	// 			status = await claudeCodeAgentState.createClaudeCodeSandbox();
	// 			break;
	// 		default:
	// 			status = "failed";
	// 			break;
	// 	}
	// 	try {
	// 		if (status === "success") {
	// 			toast.success(m.sandbox_created());
	// 		}
	// 		if (status === "failed") {
	// 			toast.error(m.sandbox_create_failed());
	// 		}
	// 		if (status === "already-exist") {
	// 			toast.info(m.sandbox_already_exist());
	// 		}
	// 	} catch (error) {
	// 		console.error(error);
	// 		toast.error(m.sandbox_create_failed());
	// 	} finally {
	// 		isCreatingSandbox = false;
	// 	}
	// }

	async function handleAddCustomSessionId() {
		if (customSessionId && customSessionId.trim() !== "") {
			claudeCodeAgentState.updateState({
				currentSessionId: customSessionId,
				sessionIds: [...claudeCodeAgentState.sessionIds, customSessionId],
			});
			customSessionId = "";
			showCustomSessionIdInput = false;
		}
	}

	function handleCodeAgentSelected(codeAgentId: string) {
		codeAgentState.updateState({ currentAgentId: codeAgentId });
	}
</script>

<div class="w-[500px]">
	<div class="flex flex-col gap-y-4 rounded-[10px] bg-background p-4">
		<div class="gap-settings-gap flex flex-col">
			<Label class="mb-2 text-label-fg">{m.title_code_agent_type()}</Label>
			<SegButton options={platformOptions} {selectedKey} onSelect={handleSelect} />
		</div>

		{#if selectedKey === "remote"}
			<Label class="text-label-fg">{m.title_agent()}</Label>
			<div class="flex w-full flex-col gap-y-2">
				<div class="flex w-full flex-row items-center gap-x-2">
					<SettingSelect
						name="agent"
						value={codeAgentState.currentAgentId}
						{options}
						placeholder={m.select_agent()}
						onValueChange={(codeAgentId) => handleCodeAgentSelected(codeAgentId)}
					/>

					<!-- <ButtonWithTooltip
						class="hover:!bg-chat-action-hover"
						tooltip={m.label_button_create_sandbox()}
						disabled={isCreatingSandbox || !claudeCodeAgentState.agentId}
						onclick={() => handleCreateSandbox(claudeCodeAgentState.agentId)}
					>
						{#if isCreatingSandbox}
							<LdrsLoader type="line-spinner" size={16} />
						{:else}
							<PackagePlus />
						{/if}
					</ButtonWithTooltip> -->
				</div>
				<!-- <p
					class={cn(
						"text-destructive/50 text-xs",
						(!claudeCodeAgentState.agentId || (claudeCodeAgentState.agentId && claudeCodeAgentState.sandboxId)) &&
							"hidden",
					)}
				>
					{m.text_lack_of_sandbox()}
				</p> -->
			</div>

			<Label class="text-label-fg">{m.title_select_session()}</Label>
			<div class="flex w-full flex-row items-center gap-x-2">
				<SettingSelect
					name="session"
					value={claudeCodeAgentState.currentSessionId}
					options={claudeCodeAgentState.sessionIds.map((id) => ({
						key: id,
						label: id,
						value: id,
					}))}
					placeholder={m.select_session()}
					onValueChange={(v) => claudeCodeAgentState.updateState({ currentSessionId: v })}
				/>
				<ButtonWithTooltip
					class={cn(
						"hover:!bg-chat-action-hover",
						showCustomSessionIdInput && "!bg-chat-action-hover",
					)}
					tooltip={m.common_custom()}
					onclick={() => {
						showCustomSessionIdInput = !showCustomSessionIdInput;
					}}
				>
					<Plus />
				</ButtonWithTooltip>
				<ButtonWithTooltip
					class="hover:!bg-chat-action-hover"
					tooltip={m.label_button_reload()}
					onclick={() => {}}
				>
					<RefreshCcw />
				</ButtonWithTooltip>
			</div>
			<div
				class={cn(
					"flex w-full flex-row items-center gap-x-2 ",
					!showCustomSessionIdInput && "hidden",
				)}
			>
				<Input
					class="!bg-settings-item-bg dark:!bg-settings-item-bg h-10 rounded-[10px]"
					bind:value={customSessionId}
					placeholder={m.placeholder_input_session_id()}
				/>
				<Button variant="secondary" onclick={() => handleAddCustomSessionId()}>
					{m.text_button_add()}
				</Button>
			</div>
		{/if}
		{#if selectedKey === "local"}
			<!-- TODO: local agent -->
			<Empty.Root>
				<Empty.Content>
					<Empty.Description>
						{m.unsupport()}
					</Empty.Description>
				</Empty.Content>
			</Empty.Root>
		{/if}
	</div>
</div>
