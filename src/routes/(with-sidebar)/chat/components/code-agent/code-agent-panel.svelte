<script lang="ts">
	import ButtonWithTooltip from "$lib/components/buss/button-with-tooltip/button-with-tooltip.svelte";
	import LdrsLoader from "$lib/components/buss/ldrs-loader/ldrs-loader.svelte";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import type { SelectOption } from "$lib/components/buss/settings/setting-select.svelte";
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import Label from "$lib/components/ui/label/label.svelte";

	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent-state.svelte";
	import { PackagePlus, RefreshCcw } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	let selectedKey = $derived(codeAgentState.type);
	let isCreatingSandbox = $state(false);

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
		codeAgentState.type = key as "local" | "remote";
	}

	async function handleCreateSandbox() {
		isCreatingSandbox = true;
		toast.loading(m.sandbox_creating());
		try {
			await codeAgentState.createClaudeCodeSandbox();
			toast.success(m.sandbox_created());
		} catch (_error) {
			toast.error(m.sandbox_create_failed());
		} finally {
			isCreatingSandbox = false;
		}
	}
</script>

<div class="w-[500px]">
	<div class="flex flex-col gap-y-4 rounded-[10px] bg-background p-4">
		<div class="gap-settings-gap flex flex-col">
			<Label class="text-label-fg">{m.title_code_agent_type()}</Label>
			<SegButton options={platformOptions} {selectedKey} onSelect={handleSelect} />
		</div>

		{#if selectedKey === "remote"}
			<Label class="text-label-fg">{m.title_agent()}</Label>
			<div class="flex w-full flex-row items-center gap-x-2">
				<SettingSelect
					name="agent"
					value={codeAgentState.agentId}
					{options}
					placeholder={m.select_agent()}
					onValueChange={(v) => (codeAgentState.agentId = v)}
				/>
				<ButtonWithTooltip
					class="hover:!bg-chat-action-hover"
					tooltip={m.label_button_create_sandbox()}
					onclick={handleCreateSandbox}
				>
					{#if isCreatingSandbox}
						<LdrsLoader type="line-spinner" />
					{:else}
						<PackagePlus />
					{/if}
				</ButtonWithTooltip>
			</div>

			<Label class="text-label-fg">{m.title_select_session()}</Label>
			<div class="flex w-full flex-row items-center gap-x-2">
				<SettingSelect
					name="session"
					value={codeAgentState.currentSessionId}
					options={codeAgentState.sessionIds.map((id) => ({
						key: id,
						label: id,
						value: id,
					}))}
					placeholder={m.select_session()}
					onValueChange={(v) => (codeAgentState.currentSessionId = v)}
				/>

				<ButtonWithTooltip
					class="hover:!bg-chat-action-hover"
					tooltip={m.label_button_reload()}
					onclick={() => {}}
				>
					<RefreshCcw />
				</ButtonWithTooltip>
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
