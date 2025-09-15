<script lang="ts">
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { ModelSelect } from "$lib/components/buss/model-select";
	import type { Model } from "$lib/stores/chat-state.svelte";
	import { cn } from "$lib/utils";

	let selectedModel = $state<Model | null>(null);
	function handleModelSelect(model: Model) {
		selectedModel = model;
	}
</script>

{#snippet trigger({ onclick }: { onclick: () => void })}
	<button
		class={cn(
			"h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y text-settings-shortcut-size flex w-full items-center justify-between",
		)}
		{onclick}
	>
		{selectedModel?.name || m.settings_newSessionModelPlaceholder()}
	</button>
{/snippet}

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_newSessionModel()}</Label>

	<ModelSelect {selectedModel} {trigger} onModelSelect={handleModelSelect} />
</div>
