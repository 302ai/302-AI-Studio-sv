<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { onMount } from "svelte";
	import { AiApplicationItems } from "../components/ai-applications";
	import { ChatInputBox } from "../components/chat-input";
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

		return () => {
			unsubClear?.();
			unsubGenerateTitle?.();
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
			<MessageList messages={chatState.messages} />
		</div>
		<div class="flex items-center justify-center">
			<ChatInputBox />
		</div>
	</div>
{/if}
