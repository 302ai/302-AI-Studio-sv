<script lang="ts">
	import ButtonWithTooltip from "$lib/components/buss/button-with-tooltip/button-with-tooltip.svelte";
	import SegButton from "$lib/components/buss/settings/seg-button.svelte";
	import type { SelectOption } from "$lib/components/buss/settings/setting-select.svelte";
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { m } from "$lib/paraglide/messages";
	import { persistedCodeAgentState } from "$lib/stores/code-agent-state.svelte";
	import { RefreshCcw } from "@lucide/svelte";

	let selectedKey = $derived(persistedCodeAgentState.current.type);

	const themeOptions = [
		{
			key: "local",
			label: m.title_local(),
		},
		{
			key: "remote",
			label: m.title_remote(),
		},
	];

	async function handleSelect(key: string) {
		persistedCodeAgentState.current.type = key as "local" | "remote";
	}

	const options: SelectOption[] = [
		{
			key: "claude-code",
			label: "Claude Code",
			value: "claude-code",
		},
	];
</script>

<div class="w-[500px]">
	<div class="flex flex-col gap-y-4 rounded-[10px] bg-background p-4">
		<div class="gap-settings-gap flex flex-col">
			<Label class="text-label-fg">{m.title_code_agent_type()}</Label>
			<SegButton options={themeOptions} {selectedKey} onSelect={handleSelect} />
		</div>

		<Label class="text-label-fg">{m.title_agent()}</Label>
		<SettingSelect
			name="agent"
			value={persistedCodeAgentState.current.agentId}
			{options}
			placeholder={m.select_agent()}
			onValueChange={(v) => (persistedCodeAgentState.current.agentId = v)}
		/>

		<Label class="text-label-fg">{m.title_select_session()}</Label>
		<div class="flex w-full flex-row items-center gap-x-2">
			<SettingSelect
				name="session"
				value={persistedCodeAgentState.current.currentSessionId}
				options={persistedCodeAgentState.current.sessionIds.map((id) => ({
					key: id,
					label: id,
					value: id,
				}))}
				placeholder={m.select_session()}
				onValueChange={(v) => (persistedCodeAgentState.current.currentSessionId = v)}
			/>

			<ButtonWithTooltip
				class="hover:!bg-chat-action-hover"
				tooltip={m.label_button_reload()}
				onclick={() => {}}
			>
				<RefreshCcw />
			</ButtonWithTooltip>
		</div>
	</div>
</div>
