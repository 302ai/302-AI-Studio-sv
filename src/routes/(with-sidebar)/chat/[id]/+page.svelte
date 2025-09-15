<script lang="ts">
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { ChatInputBox } from "../components/chat-input";
	import { MessageList } from "../components/message";
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
