<script lang="ts" module>
	export type AssistantMessage = ChatMessage & {
		role: "assistant";
	};

	interface Props {
		message: AssistantMessage;
	}
</script>

<script lang="ts">
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import { MarkdownRenderer } from "$lib/components/buss/markdown/index.js";
	import * as Alert from "$lib/components/ui/alert/index.js";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import { m } from "$lib/paraglide/messages";
	import { getLocale } from "$lib/paraglide/runtime";
	import type { ChatMessage } from "$lib/types/chat";
	import AlertCircleIcon from "@lucide/svelte/icons/alert-circle";
	import MessageActions from "./message-actions.svelte";
	import { formatTimeAgo } from "./utils";

	const { message }: Props = $props();
</script>

{#snippet messageHeader()}
	{@const modelName = message.model.name}
	<div class="flex items-center gap-2">
		<ModelIcon className="size-6" {modelName} />
		<span class="text-muted-foreground text-xs">{modelName}</span>
	</div>
{/snippet}

{#snippet messageStatus()}
	{#if message.status === "pending"}
		<div class="text-muted-foreground flex items-center gap-2 text-sm">
			{m.text_chat_pending()}
			<LdrsLoader type="dot-pulse" size={16} />
		</div>
	{:else if message.status === "error"}
		<Alert.Root variant="destructive" class="border-destructive bg-destructive/10">
			<AlertCircleIcon />
			<Alert.Title>{m.text_alert_chat_error()}</Alert.Title>
			<Alert.Description>{m.text_alert_chat_error_description()}</Alert.Description>
		</Alert.Root>
	{/if}
{/snippet}

{#snippet messageFooter()}
	<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100">
		<MessageActions {message} />
		<span class="text-muted-foreground text-xs">
			{formatTimeAgo(message.createAt.toLocaleString(), getLocale())}
		</span>
	</div>
{/snippet}

<div class="group flex flex-col gap-2">
	{@render messageHeader()}

	<MarkdownRenderer content={message.content} />

	{@render messageStatus()}

	{@render messageFooter()}
</div>
