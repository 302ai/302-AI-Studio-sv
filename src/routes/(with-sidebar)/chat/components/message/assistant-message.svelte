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
	import { m } from "$lib/paraglide/messages.js";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import type { ChatMessage } from "$lib/types/chat";
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from "$lib/components/ui/collapsible";
	import { ChevronDown, Lightbulb } from "@lucide/svelte";
	import MessageActions from "./message-actions.svelte";
	import { formatTimeAgo } from "./utils";

	let { message }: Props = $props();

	let isReasoningExpanded = $state(false);
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
			<MarkdownRenderer
				content={part.text}
				codeTheme={persistedThemeState.current.shouldUseDarkColors
					? "vitesse-dark"
					: "vitesse-light"}
			/>
		{:else if part.type === "reasoning"}
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
				</CollapsibleContent>
			</Collapsible>
		{/if}
	{/each}

	{@render messageFooter()}
</div>
