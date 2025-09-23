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
	import type { ChatMessage } from "$lib/types/chat";

	let { message }: Props = $props();
</script>

{#snippet messageHeader()}
	{@const modelName = "测试模型"}
	<div class="flex items-center gap-2">
		<ModelIcon className="size-6" {modelName} />
		<span class="text-xs text-muted-foreground">{modelName}</span>
	</div>
{/snippet}

<!-- {#snippet messageFooter()}
	<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100">
		<MessageActions {message} />
		<span class="text-xs text-muted-foreground">
			{formatTimeAgo(message.metadata?.createdAt?.toLocaleString() || "", getLocale())}
		</span>
	</div>
{/snippet} -->

<div class="group flex flex-col gap-2">
	{@render messageHeader()}

	{#each message.parts as part, partIndex (partIndex)}
		{#if part.type === "text"}
			<MarkdownRenderer content={part.text} />
		{/if}
	{/each}

	<!-- {@render messageFooter()} -->
</div>
