<script lang="ts">
	import sendMessageIcon from "$lib/assets/send-message.svg";
	import { ModelSelect } from "$lib/components/buss/model-select";
	import { Button } from "$lib/components/ui/button";
	import { Separator } from "$lib/components/ui/separator";
	import { Textarea } from "$lib/components/ui/textarea";
	import { m } from "$lib/paraglide/messages.js";
	import { chat, chatState } from "$lib/stores/chat-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { cn } from "$lib/utils";
	import { toast } from "svelte-sonner";
	import { match } from "ts-pattern";
	import { AttachmentThumbnailBar } from "../attachment";
	import ChatActions from "./chat-actions.svelte";
	import StreamingIndicator from "./streaming-indicator.svelte";

	let openModelSelect = $state<() => void>();

	// Check if any providers are properly configured with API keys
	const hasConfiguredProviders = $derived(() => {
		return persistedProviderState.current.some(
			(provider) => provider.enabled && provider.apiKey && provider.apiKey.trim() !== "",
		);
	});

	async function handleGoToModelSettings() {
		await tabBarState.handleNewTab(
			m.title_settings(),
			"settings",
			true,
			"/settings/model-settings",
		);
	}

	function handleSendMessage() {
		match({
			isEmpty: chatState.inputValue.trim() === "" && chatState.attachments.length === 0,
			noProviders: !hasConfiguredProviders(),
			noModel: chatState.selectedModel === null,
		})
			.with({ isEmpty: true }, () => {
				toast.warning(m.toast_empty_message());
			})
			.with({ noProviders: true }, () => {
				toast.info(m.toast_no_provider_configured(), {
					action: {
						label: m.text_button_go_to_settings(),
						onClick: () => handleGoToModelSettings(),
					},
				});
			})
			.with({ noModel: true }, () => {
				toast.warning(m.toast_no_model(), {
					action: {
						label: m.text_button_select_model(),
						onClick: () => {
							if (!hasConfiguredProviders()) {
								toast.info(m.toast_no_provider_configured(), {
									action: {
										label: m.text_button_go_to_settings(),
										onClick: () => handleGoToModelSettings(),
									},
								});
								return;
							}
							openModelSelect?.();
						},
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
	<StreamingIndicator />
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
			<ChatActions />

			<div class="flex items-center gap-2">
				<ModelSelect
					selectedModel={chatState.selectedModel}
					onModelSelect={(model) => chatState.handleSelectedModelChange(model)}
				>
					{#snippet trigger({ onclick })}
						{((openModelSelect = () => {
							if (!hasConfiguredProviders()) {
								toast.info(m.toast_no_provider_configured(), {
									action: {
										label: m.text_button_go_to_settings(),
										onClick: () => handleGoToModelSettings(),
									},
								});
								return;
							}
							onclick();
						}),
						"")}
						<Button
							variant="ghost"
							class="text-sm text-foreground/50 hover:!bg-chat-action-hover"
							onclick={() => {
								if (!hasConfiguredProviders()) {
									toast.info(m.toast_no_provider_configured(), {
										action: {
											label: m.text_button_go_to_settings(),
											onClick: () => handleGoToModelSettings(),
										},
									});
									return;
								}
								openModelSelect?.();
							}}
						>
							{chatState.selectedModel?.name ?? m.text_button_select_model()}
						</Button>
					{/snippet}
				</ModelSelect>

				<Separator
					orientation="vertical"
					class="rounded-2xl data-[orientation=vertical]:h-1/2 data-[orientation=vertical]:w-0.5"
				/>

				<button
					disabled={chat.status === "streaming"}
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
