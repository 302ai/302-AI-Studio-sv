<script lang="ts">
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader/index.js";
	import { Button } from "$lib/components/ui/button";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import { Square } from "@lucide/svelte";
	import { slide } from "svelte/transition";

	const displayText = $derived.by(() => {
		if (
			chatState.lastAssistantMessage?.parts.some((part) => part.type === "reasoning") &&
			!chatState.lastAssistantMessage?.parts.some((part) => part.type === "text")
		) {
			return m.title_thinking();
		}
		return m.text_chat_responding();
	});
</script>

{#if chatState.isStreaming}
	<div class="flex justify-center mb-3">
		<div
			class="flex items-center gap-3 rounded-lg bg-muted/10 px-3 py-2"
			transition:slide={{ duration: 200, axis: "y" }}
		>
			<div class="flex items-center gap-2">
				<LdrsLoader
					type="dot-pulse"
					size={14}
					speed={1.3}
					color={persistedThemeState.current.shouldUseDarkColors ? "#a1a1aa" : "#71717a"}
				/>
				<span class="text-xs text-muted-foreground">
					{displayText}...
				</span>
			</div>
			<Button
				variant="ghost"
				size="sm"
				class="h-6 px-2 text-xs text-muted-foreground hover:text-destructive hover:!bg-destructive/10"
				onclick={chatState.stopGeneration}
			>
				<Square class="h-3 w-3 fill-current" />
			</Button>
		</div>
	</div>
{/if}
