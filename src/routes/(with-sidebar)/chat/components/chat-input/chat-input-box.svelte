<script lang="ts">
	import sendMessageIcon from "$lib/assets/send-message.svg";
	import { ModelSelect } from "$lib/components/buss/model-select";
	import { Button } from "$lib/components/ui/button";
	import { Separator } from "$lib/components/ui/separator";
	import { Textarea } from "$lib/components/ui/textarea";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { modelPanelState } from "$lib/stores/model-panel-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { cn } from "$lib/utils";
	import type { AttachmentFile } from "@shared/types";
	import { nanoid } from "nanoid";
	import { toast } from "svelte-sonner";
	import { match } from "ts-pattern";
	import { AttachmentThumbnailBar } from "../attachment";
	import { MAX_ATTACHMENT_COUNT } from "../attachment/attachment-uploader.svelte";
	import ChatActions from "./chat-actions.svelte";
	import StreamingIndicator from "./streaming-indicator.svelte";

	let openModelSelect = $state<() => void>();
	let isComposing = $state(false); // 跟踪输入法composition状态

	$effect(() => {
		if (modelPanelState.isOpen && openModelSelect) {
			openModelSelect();
			modelPanelState.close();
		}
	});

	// Check if any providers are properly configured with API keys
	const hasConfiguredProviders = $derived(() => {
		return persistedProviderState.current.some(
			(provider) => provider.enabled && provider.apiKey && provider.apiKey.trim() !== "",
		);
	});

	async function handleGoToModelSettings() {
		await window.electronAPI.windowService.handleOpenSettingsWindow("/settings/model-settings");
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

	async function generatePreview(file: File): Promise<string | undefined> {
		if (file.type.startsWith("image/")) {
			return new Promise((resolve) => {
				const reader = new FileReader();
				reader.onload = (e) => resolve(e.target?.result as string);
				reader.onerror = () => resolve(undefined);
				reader.readAsDataURL(file);
			});
		}

		// Generate data URL for PDF files
		if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
			return new Promise((resolve) => {
				const reader = new FileReader();
				reader.onload = (e) => resolve(e.target?.result as string);
				reader.onerror = () => resolve(undefined);
				reader.readAsDataURL(file);
			});
		}

		return undefined;
	}

	async function handlePaste(event: ClipboardEvent) {
		const items = event.clipboardData?.items;
		if (!items) return;

		const files: File[] = [];

		for (const item of Array.from(items)) {
			if (item.kind === "file") {
				const file = item.getAsFile();
				if (file) files.push(file);
			}
		}

		if (files.length === 0) return;

		event.preventDefault();

		const newAttachments: AttachmentFile[] = [];

		for (const file of files) {
			if (chatState.attachments.length + newAttachments.length >= MAX_ATTACHMENT_COUNT) {
				break;
			}

			const preview = await generatePreview(file);
			const filePath = (file as File & { path?: string }).path || file.name;

			newAttachments.push({
				id: nanoid(),
				name: file.name || `pasted-file-${Date.now()}`,
				type: file.type,
				size: file.size,
				file,
				preview,
				filePath,
			});
		}

		if (newAttachments.length > 0) {
			chatState.addAttachments(newAttachments);
		}
	}
</script>

<div class="relative w-full max-w-chat-max-w" data-layoutid="chat-input-container">
	<AttachmentThumbnailBar />
	<div class="absolute left-0 right-0 -top-14 z-10">
		<StreamingIndicator />
	</div>
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
				if (e.key === "Enter" && !e.shiftKey && !isComposing) {
					handleSendMessage();
					e.preventDefault();
				}
			}}
			oncompositionstart={() => {
				isComposing = true;
			}}
			oncompositionend={() => {
				isComposing = false;
			}}
			onpaste={handlePaste}
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
							class="text-sm text-foreground/50 hover:!bg-chat-action-hover max-w-[200px]"
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
							<p class="truncate">
								{chatState.selectedModel?.name ?? m.text_button_select_model()}
							</p>
						</Button>
					{/snippet}
				</ModelSelect>

				<Separator
					orientation="vertical"
					class="rounded-2xl data-[orientation=vertical]:h-1/2 data-[orientation=vertical]:w-0.5"
				/>

				<button
					disabled={!chatState.sendMessageEnabled}
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
