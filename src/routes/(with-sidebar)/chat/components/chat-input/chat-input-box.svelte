<script lang="ts">
	import sendMessageIcon from "$lib/assets/send-message.svg";
	import { m } from "$lib/paraglide/messages.js";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { ModelSelect } from "$lib/components/buss/model-select";
	import { Button } from "$lib/components/ui/button";
	import { Separator } from "$lib/components/ui/separator";
	import { Textarea } from "$lib/components/ui/textarea";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { cn } from "$lib/utils";
	import mcpIcon from "@lobehub/icons-static-svg/icons/mcp.svg";
	import { Globe, Lightbulb, Settings2 } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { match } from "ts-pattern";
	import { AttachmentThumbnailBar, AttachmentUploader } from "../attachment";

	let actionDisabled = $derived(chatState.providerType !== "302ai");
	let openModelSelect = $state<() => void>();

	function handleSendMessage() {
		match({
			isEmpty: chatState.inputValue.trim() === "" && chatState.attachments.length === 0,
			noModel: chatState.selectedModel === null,
		})
			.with({ isEmpty: true }, () => {
				toast.warning(m.toast_empty_message());
			})
			.with({ noModel: true }, () => {
				toast.warning(m.toast_no_model(), {
					action: {
						label: m.text_button_select_model(),
						onClick: () => openModelSelect?.(),
					},
				});
			})
			.otherwise(() => {
				if (chatState.hasMessages) {
					chatState.sendMessage();
				} else {
					document.startViewTransition(() => chatState.sendMessage());
				}
			});
	}
</script>

<div class="w-full max-w-chat-max-w" data-layoutid="chat-input-container">
	<AttachmentThumbnailBar />
	<div
		class={cn(
			"transition-[color,box-shadow]",
			"flex max-h-chat-max-h min-h-chat-min-h w-full flex-col justify-between rounded-chat border p-chat-pad pb-1.5",
			"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 focus-within:outline-hidden",
			"bg-input",
		)}
		data-layoutid="chat-input-box"
	>
		<Textarea
			class={cn(
				"w-full resize-none p-0",
				"border-none shadow-none focus-within:ring-0 focus-within:outline-hidden focus-visible:ring-0",
			)}
			bind:value={chatState.inputValue}
			placeholder={m.placeholder_input_chat()}
			onkeydown={(e) => {
				if (e.key === "Enter" && !e.shiftKey) {
					handleSendMessage();
					e.preventDefault();
				}
			}}
		/>

		<div class="mt-1.5 flex flex-row justify-between">
			<div class="flex h-chat-bar items-center gap-chat-bar-gap">
				<AttachmentUploader />
				<ButtonWithTooltip
					class={cn(
						"hover:!bg-chat-action-hover",
						chatState.isThinkingActive && "!bg-chat-action-active hover:!bg-chat-action-active",
					)}
					tooltip={actionDisabled ? m.title_unsupport_action() : m.title_thinking()}
					onclick={() => chatState.handleThinkingActiveChange(!chatState.isThinkingActive)}
				>
					<Lightbulb class={cn(chatState.isThinkingActive && "!text-chat-action-active-fg")} />
				</ButtonWithTooltip>
				<ButtonWithTooltip
					class={cn(
						"hover:!bg-chat-action-hover",
						chatState.isOnlineSearchActive && "!bg-chat-action-active hover:!bg-chat-action-active",
					)}
					tooltip={actionDisabled ? m.title_unsupport_action() : m.title_online_search()}
					onclick={() => chatState.handleOnlineSearchActiveChange(!chatState.isOnlineSearchActive)}
				>
					<Globe class={cn(chatState.isOnlineSearchActive && "!text-chat-action-active-fg")} />
				</ButtonWithTooltip>
				<ButtonWithTooltip
					class={cn(
						"hover:!bg-chat-action-hover",
						chatState.isMCPActive && "!bg-chat-action-active hover:!bg-chat-action-active",
					)}
					tooltip={m.chat_mcpServers()}
					onclick={() => chatState.handleMCPActiveChange(!chatState.isMCPActive)}
				>
					<img
						src={mcpIcon}
						alt="MCP"
						class={cn(
							"size-chat-icon group-hover:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:invert",
							chatState.isMCPActive &&
								"[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)] dark:[filter:brightness(0)_saturate(100%)_invert(35%)_sepia(84%)_saturate(2329%)_hue-rotate(244deg)_brightness(92%)_contrast(96%)]",
						)}
					/>
				</ButtonWithTooltip>
				<ButtonWithTooltip class="hover:!bg-chat-action-hover" tooltip={m.chat_parameters()}>
					<Settings2 />
				</ButtonWithTooltip>
			</div>

			<div class="flex items-center gap-2">
				<ModelSelect
					selectedModel={chatState.selectedModel}
					onModelSelect={(model) => chatState.handleSelectedModelChange(model)}
				>
					{#snippet trigger({ onclick })}
						{((openModelSelect = onclick), "")}
						<Button variant="ghost" class="text-xs hover:!bg-chat-action-hover" {onclick}>
							{chatState.selectedModel?.name ?? m.text_button_select_model()}
						</Button>
					{/snippet}
				</ModelSelect>

				<Separator
					orientation="vertical"
					class="rounded-2xl data-[orientation=vertical]:h-1/2 data-[orientation=vertical]:w-0.5"
				/>

				<button
					class={cn(
						"flex size-9 items-center justify-center rounded-[10px] bg-chat-send-message-button text-foreground hover:!bg-chat-send-message-button/80",
						"disabled:cursor-not-allowed disabled:bg-chat-send-message-button/50 disabled:hover:!bg-chat-send-message-button/50",
					)}
					onclick={handleSendMessage}
				>
					<img src={sendMessageIcon} alt="plane" class="size-5" />
				</button>
			</div>
		</div>
	</div>
</div>
