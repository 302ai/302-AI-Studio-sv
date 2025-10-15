<script lang="ts" module>
	export type AssistantMessage = ChatMessage & {
		role: "assistant";
	};

	interface Props {
		message: AssistantMessage;
	}
</script>

<script lang="ts">
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader/index.js";
	import { MarkdownRenderer } from "$lib/components/buss/markdown/index.js";
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from "$lib/components/ui/collapsible";
	import { m } from "$lib/paraglide/messages.js";
	import { getLocale } from "$lib/paraglide/runtime";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import type { ChatMessage } from "$lib/types/chat";
	import { ChevronDown, Lightbulb } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import MessageActions from "./message-actions.svelte";
	import MessageContextMenu from "./message-context-menu.svelte";
	import { formatTimeAgo, getAssistantMessageContent } from "./utils";

	let { message }: Props = $props();

	let isReasoningExpanded = $state(!preferencesSettings.autoCollapseThink);

	$effect(() => {
		if (isStreamingReasoning) {
			isReasoningExpanded = true;
		} else if (!isCurrentMessageStreaming) {
			// When streaming ends, restore to the initial state based on settings
			isReasoningExpanded = !preferencesSettings.autoCollapseThink;
		}
	});

	const isCurrentMessageStreaming = $derived(
		chatState.isLastMessageStreaming && chatState.lastAssistantMessage?.id === message.id,
	);

	const hasReasoningContent = $derived(message.parts.some((part) => part.type === "reasoning"));
	const hasTextContent = $derived(message.parts.some((part) => part.type === "text"));
	const isStreamingReasoning = $derived(
		isCurrentMessageStreaming && hasReasoningContent && !hasTextContent,
	);
	const isStreamingText = $derived(
		isCurrentMessageStreaming && (hasTextContent || (!hasReasoningContent && !hasTextContent)),
	);

	async function handleCopyMessage() {
		try {
			await navigator.clipboard.writeText(getAssistantMessageContent(message));
			toast.success(m.toast_copied_success());
		} catch {
			toast.error(m.toast_copied_failed());
		}
	}

	function handleRegenerate() {
		chatState.regenerateMessage(message.id);
	}
</script>

{#snippet messageHeader(model: string)}
	<div class="flex items-center gap-2">
		<ModelIcon className="size-6" modelName={model} />
		<span class="text-xs text-muted-foreground">{model}</span>
	</div>
{/snippet}

{#snippet messageFooter()}
	<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100">
		<MessageActions {message} enabledActions={["copy", "regenerate"]} />
		<span class="text-xs text-muted-foreground">
			{formatTimeAgo(message.metadata?.createdAt?.toLocaleString() || "", getLocale())}
		</span>
	</div>
{/snippet}

<MessageContextMenu onCopy={handleCopyMessage} onRegenerate={handleRegenerate}>
	<div class="group flex flex-col gap-2">
		{@render messageHeader(message.metadata?.model || "gpt-4o")}

		{#each message.parts as part, partIndex (partIndex)}
			{#if part.type === "text"}
				{#if preferencesSettings.autoDisableMarkdown}
					<div class="whitespace-pre-wrap text-sm leading-relaxed">
						{part.text}
					</div>
				{:else}
					<MarkdownRenderer
						content={part.text}
						codeTheme={persistedThemeState.current.shouldUseDarkColors
							? "vitesse-dark"
							: "vitesse-light"}
					/>
				{/if}
			{:else if part.type === "reasoning"}
				{#if !preferencesSettings.autoHideReason}
					<Collapsible bind:open={isReasoningExpanded} class="rounded-lg border bg-muted/30 p-3">
						<CollapsibleTrigger
							class="flex w-full items-center justify-between text-left transition-colors hover:bg-muted/20 rounded-md p-2 -m-2"
						>
							<div class="flex items-center gap-2">
								<Lightbulb class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm font-medium text-muted-foreground">{m.title_thinking()}</span>
							</div>
							<ChevronDown
								class="h-4 w-4 text-muted-foreground transition-transform duration-200 {isReasoningExpanded
									? 'rotate-180'
									: ''}"
							/>
						</CollapsibleTrigger>
						<CollapsibleContent class="space-y-2">
							<div class="pt-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
								{part.text}
							</div>

							{#if isStreamingReasoning}
								<div class="flex items-center gap-2 pt-2 animate-in fade-in duration-300">
									<LdrsLoader
										type="dot-pulse"
										size={16}
										speed={1.2}
										color={persistedThemeState.current.shouldUseDarkColors ? "#a1a1aa" : "#71717a"}
									/>
									<span class="text-xs text-muted-foreground italic">
										{m.title_thinking()}...
									</span>
								</div>
							{/if}
						</CollapsibleContent>
					</Collapsible>
				{/if}
			{/if}
		{/each}
		{#if isStreamingText}
			<div class="flex items-center gap-3 py-3 animate-in fade-in duration-300">
				<div class="flex items-center justify-center">
					<LdrsLoader
						type="dot-pulse"
						size={24}
						speed={1.2}
						color={persistedThemeState.current.shouldUseDarkColors ? "#a1a1aa" : "#71717a"}
					/>
				</div>
				<span class="text-sm text-muted-foreground italic">
					{m.text_chat_responding()}...
				</span>
			</div>
		{/if}

		{@render messageFooter()}
	</div>
</MessageContextMenu>
