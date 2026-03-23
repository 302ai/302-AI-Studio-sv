<script lang="ts" module>
	import sendMessageIcon from "$lib/assets/send-message.svg";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { m } from "$lib/paraglide/messages";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentSendMessageButtonState } from "$lib/stores/code-agent/code-agent-send-message-button-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { cn } from "$lib/utils";

	export interface CodeAgentSendMessageButtonProps {
		onClick: () => void;
	}
</script>

<script lang="ts">
	const { onClick }: CodeAgentSendMessageButtonProps = $props();

	let disabled = $derived(
		!chatState.sendMessageEnabled ||
			codeAgentState.isDeleted ||
			codeAgentSendMessageButtonState.isChecking ||
			codeAgentSendMessageButtonState.isOpenClawSendDisabled,
	);
</script>

<Dialog.Root bind:open={codeAgentSendMessageButtonState.showLackOfDiskDialog}>
	<button
		class={cn(
			"shrink-0 flex size-9 items-center cursor-pointer justify-center rounded-[10px] bg-chat-send-message-button text-foreground hover:!bg-chat-send-message-button/80",
			"disabled:cursor-not-allowed disabled:bg-chat-send-message-button/50 disabled:hover:!bg-chat-send-message-button/50",
		)}
		{disabled}
		onclick={onClick}
	>
		{#if codeAgentSendMessageButtonState.isChecking}
			<LdrsLoader type="line-spinner" size={18} />
		{:else}
			<img src={sendMessageIcon} alt="plane" class="size-5" />
		{/if}
	</button>

	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.title_lack_of_disk()}</Dialog.Title>
		</Dialog.Header>

		<Dialog.Description>
			<p>
				{m.description_lack_of_disk()}: {codeAgentState.selectedSandboxRemark === ""
					? m.no_remark()
					: codeAgentState.selectedSandboxRemark}
			</p>
			<p>{m.description_lack_of_disk_2()}: {codeAgentState.selectedSandboxId}</p>
		</Dialog.Description>

		<Dialog.Description>
			<p>{m.description_lack_of_disk_3()}</p>
			<p>{m.description_lack_of_disk_4()}</p>
		</Dialog.Description>

		<Dialog.Footer class="flex flex-row items-center sm:justify-between">
			<Button
				variant="secondary"
				onclick={() => codeAgentSendMessageButtonState.handleContinueAnyway()}
			>
				{m.text_button_still_continue()}
			</Button>
			<Button onclick={() => codeAgentSendMessageButtonState.handleChangeSandbox()}>
				{m.text_button_replace_sandbox()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
