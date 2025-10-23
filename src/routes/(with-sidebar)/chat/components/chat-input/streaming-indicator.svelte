<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { isMac } from "$lib/utils/platform";
	import { Square } from "@lucide/svelte";
</script>

{#if chatState.isStreaming}
	<div class="flex justify-center">
		<Button
			variant="ghost"
			size="sm"
			class="flex items-center gap-2 rounded-lg bg-muted/10 px-3 py-2 text-xs text-muted-foreground hover:text-destructive hover:!bg-destructive/10"
			onclick={chatState.stopGeneration}
		>
			<Square class="h-3 w-3 fill-current" />
			<span>{m.text_chat_stop_generation({ key: isMac ? "⌘D" : "Ctrl+D" })}</span>
		</Button>
	</div>
{/if}
