<script lang="ts">
	import * as Resizable from "$lib/components/ui/resizable/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { chat, chatState } from "$lib/stores/chat-state.svelte";
	import { htmlPreviewState } from "$lib/stores/html-preview-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import type { ThreadParmas } from "@shared/types";
	import { onMount } from "svelte";
	import { AiApplicationItems } from "../components/ai-applications";
	import { ChatInputBox } from "../components/chat-input";
	import { HtmlPreviewPanel } from "../components/html-preview";
	import { MessageList } from "../components/message";

	onMount(() => {
		// Listen for clear messages event from main process
		const unsubClear = window.electronAPI?.onTabClearMessages?.(({ tabId, threadId }) => {
			console.log("[Chat Page] Received clear messages event:", { tabId, threadId });
			// Clear the in-memory chat state
			chatState.clearMessages();
		});

		// Listen for generate title event from main process
		const unsubGenerateTitle = window.electronAPI?.onTabGenerateTitle?.(
			async ({ tabId, threadId }) => {
				console.log("[Chat Page] Received generate title event:", { tabId, threadId });
				// Generate title for the current chat
				await chatState.generateTitleManually();
			},
		);

		// Listen for trigger send message event (for branch and send)
		const unsubTriggerSend = window.electronAPI?.onTriggerSendMessage?.(
			async (data: { threadId: string }) => {
				console.log("[Chat Page] Received trigger-send-message event:", data);
				// Only trigger send if this is the target thread
				if (data.threadId === chatState.id) {
					// Wait a moment to ensure state is fully loaded
					await new Promise((resolve) => setTimeout(resolve, 100));
					// Trigger send if there's content
					if (chatState.sendMessageEnabled) {
						await chatState.sendMessage();
					}
				}
			},
		);

		// Check if we should auto-send on load (for branch and send functionality)
		const checkAutoSend = async () => {
			const threadKey = `app-thread:${chatState.id}`;
			const threadData = await window.electronAPI?.storageService?.getItem(threadKey);

			if (
				threadData &&
				typeof threadData === "object" &&
				(threadData as ThreadParmas).autoSendOnLoad === true
			) {
				console.log("[Chat Page] Auto-send on load detected for thread:", chatState.id);

				// Clear the flag immediately to prevent re-sending
				await window.electronAPI.storageService.setItem(threadKey, {
					...(threadData as ThreadParmas),
					autoSendOnLoad: false,
				});

				// Wait a moment for the UI to fully initialize
				await new Promise((resolve) => setTimeout(resolve, 300));

				// Trigger AI reply generation
				// The user message is already in the message list, we just need to trigger AI response
				const currentModel = chatState.selectedModel;
				if (currentModel) {
					console.log("[Chat Page] Triggering AI reply generation...");
					try {
						// Directly call chat.sendMessage with undefined to trigger AI reply
						// This won't add a new user message, just generate AI response
						await chat.sendMessage(undefined, {
							body: {
								model: currentModel.id,
								apiKey: persistedProviderState.current.find((p) => p.id === currentModel.providerId)
									?.apiKey,
							},
						});
					} catch (error) {
						console.error("[Chat Page] Failed to trigger AI reply:", error);
					}
				} else {
					console.warn("[Chat Page] Cannot auto-send: no model selected");
				}
			}
		};

		// Run auto-send check after a short delay to ensure state is loaded
		setTimeout(() => {
			checkAutoSend();
		}, 100);

		return () => {
			unsubClear?.();
			unsubGenerateTitle?.();
			unsubTriggerSend?.();
		};
	});
</script>

{#if !chatState.hasMessages}
	<div class="flex h-full flex-col items-center justify-center gap-y-6">
		<div class="flex w-full flex-col items-center justify-center gap-chat-gap-y">
			<span class="text-center text-chat-slogan" data-layoutid="chat-slogan">{m.app_slogan()}</span>
			<ChatInputBox />
		</div>
		{#if preferencesSettings.enableSupermarket}<AiApplicationItems />{/if}
	</div>
{:else}
	<div class="flex h-full flex-col gap-y-4">
		<div class="flex-1 overflow-hidden" data-layoutid="chat-message-list">
			{#if htmlPreviewState.isVisible}
				<Resizable.PaneGroup direction="horizontal" class="h-full">
					<Resizable.Pane defaultSize={50} minSize={20}>
						<div class="h-full overflow-hidden">
							<MessageList messages={chatState.messages} />
						</div>
					</Resizable.Pane>
					<Resizable.Handle withHandle />
					<Resizable.Pane defaultSize={50} minSize={20}>
						<HtmlPreviewPanel />
					</Resizable.Pane>
				</Resizable.PaneGroup>
			{:else}
				<MessageList messages={chatState.messages} />
			{/if}
		</div>
		<div class="flex items-center justify-center">
			<ChatInputBox />
		</div>
	</div>
{/if}
