<script lang="ts">
	import { openaiHandler } from "$lib/handlers/chat-handlers";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { FChatTransport } from "$lib/transport/f-chat-transport";
	import { Chat } from "@ai-sdk/svelte";
	import { ChatInputBox } from "../components/chat-input";
	import { MessageList } from "../components/message";

	let input = $state("");

	const chat = new Chat({
		transport: new FChatTransport({
			handler: openaiHandler,
			body: {
				temperature: 0.7,
			},
		}),
	});
</script>

{#if !chatState.hasMessages}
	<div class="flex h-full flex-col items-center justify-center gap-chat-gap-y">
		<span class="text-center text-chat-slogan" data-layoutid="chat-slogan">{m.app_slogan()}</span>
		<ChatInputBox />
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
