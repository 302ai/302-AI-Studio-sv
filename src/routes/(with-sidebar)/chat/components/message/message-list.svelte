<script lang="ts">
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import type { ChatMessage } from "$lib/stores/chat-state.svelte";
	import AssistantMessage from "./assistant-message.svelte";
	import UserMessage from "./user-message.svelte";

	interface Props {
		messages: ChatMessage[];
	}

	let { messages }: Props = $props();
</script>

<ScrollArea class="h-full w-full">
	<div class="flex w-full justify-center">
		<div class="w-full max-w-[720px] space-y-4 py-8">
			{#each messages as message (message.id)}
				{#if message.role === "user"}
					<UserMessage
						message={{ ...message, role: "user" as const, attachments: message.attachments ?? [] }}
					/>
				{:else if message.role === "assistant"}
					<AssistantMessage
						message={{
							...message,
							role: "assistant" as const,
							status: message.status,
						}}
					/>
				{/if}
			{/each}
		</div>
	</div>
</ScrollArea>
