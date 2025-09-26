<script lang="ts" module>
	export type AssistantMessage = ChatMessage & {
		role: "assistant";
	};

	interface Props {
		message: AssistantMessage;
	}
</script>

<script lang="ts">
	import { MarkdownRenderer } from "$lib/components/buss/markdown/index.js";
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import { getLocale } from "$lib/paraglide/runtime";
	import type { ChatMessage } from "$lib/types/chat";
	import MessageActions from "./message-actions.svelte";
	import { formatTimeAgo } from "./utils";

	let { message }: Props = $props();
</script>

{#snippet messageHeader(model: string)}
	<div class="flex items-center gap-2">
		<ModelIcon className="size-6" modelName={model} />
		<span class="text-xs text-muted-foreground">{model}</span>
	</div>
{/snippet}

{#snippet messageFooter()}
	<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100">
		<MessageActions {message} />
		<span class="text-xs text-muted-foreground">
			{formatTimeAgo(message.metadata?.createdAt?.toLocaleString() || "", getLocale())}
		</span>
	</div>
{/snippet}

<div class="group flex flex-col gap-2">
	{@render messageHeader(message.metadata?.model || "gpt-4o")}

	{#each message.parts as part, partIndex (partIndex)}
		{#if part.type === "text"}
			<MarkdownRenderer content={part.text} />
		{:else if part.type === "reasoning"}
			<div class="text-xs text-muted-foreground">{part.text}</div>
		{/if}
	{/each}

	{@render messageFooter()}
</div>
