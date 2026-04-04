<script lang="ts">
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader/index.js";
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from "$lib/components/ui/collapsible";
	import { m } from "$lib/paraglide/messages.js";
	import { chatUIState, persistedChatUIState } from "$lib/stores/chat-ui-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import { ChevronDown, Lightbulb } from "@lucide/svelte";

	interface Props {
		text: string;
		messageId: string;
		index: number;
		isStreamingReasoning?: boolean;
		isCurrentMessageStreaming?: boolean;
	}

	let {
		text,
		messageId,
		index,
		isStreamingReasoning = false,
		isCurrentMessageStreaming = false,
	}: Props = $props();

	let isExpanded = $state(
		chatUIState.getReasoningState(messageId, index) ?? !preferencesSettings.autoCollapseThink,
	);

	// Sync with persisted state (handles updates from other windows)
	$effect(() => {
		const persisted =
			persistedChatUIState.current.reasoningState[messageId]?.[index.toString()];
		if (persisted !== undefined && persisted !== isExpanded) {
			isExpanded = persisted;
		}
	});

	// Sync with settings ONLY during streaming
	$effect(() => {
		if (isCurrentMessageStreaming) {
			isExpanded = !preferencesSettings.autoCollapseThink;
		}
	});

	// Snapshot when streaming ends
	let wasStreaming = $state(false);
	$effect(() => {
		if (isCurrentMessageStreaming) {
			wasStreaming = true;
		} else {
			// When stream ends
			if (wasStreaming) {
				chatUIState.setReasoningState(messageId, index, isExpanded);
			}
			wasStreaming = false;
		}
	});

	function handleOpenChange(open: boolean) {
		isExpanded = open;
		// Manual toggle always persists state
		chatUIState.setReasoningState(messageId, index, open);
	}
</script>

{#if !preferencesSettings.autoHideReason}
	<Collapsible
		open={isExpanded}
		onOpenChange={handleOpenChange}
		class="mb-4 w-full max-w-[65ch] rounded-lg border bg-muted/30 p-3"
	>
		<CollapsibleTrigger
			class="flex w-full items-center justify-between text-left transition-colors hover:bg-muted/20 rounded-md p-2"
		>
			<div class="flex items-center gap-2">
				<Lightbulb class="h-4 w-4 text-muted-foreground" />
				<span class="text-sm font-medium text-muted-foreground">{m.title_thinking()}</span>
			</div>
			<ChevronDown
				class="h-4 w-4 text-muted-foreground transition-transform duration-200 {isExpanded
					? 'rotate-180'
					: ''}"
			/>
		</CollapsibleTrigger>
		<CollapsibleContent class="space-y-2">
			<div class="pt-3">
				{#if preferencesSettings.autoDisableMarkdown}
					<div
						class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-all"
					>
						{text}
					</div>
				{:else}
					<div
						class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-all"
					>
						{text.replace(/\\n/g, "\n").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
					</div>
				{/if}
			</div>

			{#if isStreamingReasoning}
				<div class="flex items-center gap-2 pt-2 animate-in fade-in duration-300">
					<LdrsLoader
						type="dot-pulse"
						size={16}
						speed={1.2}
						color={persistedThemeState.current.shouldUseDarkColors
							? "#a1a1aa"
							: "#71717a"}
					/>
					<span class="text-xs text-muted-foreground italic">
						{m.title_thinking()}...
					</span>
				</div>
			{/if}
		</CollapsibleContent>
	</Collapsible>
{/if}
