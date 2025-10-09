<script lang="ts">
	import { ModelSelect } from "$lib/components/buss/model-select";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { cn } from "$lib/utils";
	import type { Model } from "@shared/types";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";

	function handleModelSelect(model: Model) {
		preferencesSettings.setTitleGenerationModel(model);
	}
</script>

{#snippet trigger({ onclick }: { onclick: () => void })}
	<button
		class={cn(
			"h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y text-settings-shortcut-size flex w-full items-center justify-between",
		)}
		{onclick}
	>
		{preferencesSettings.titleGenerationModel?.name ||
			m.settings_titleGenerationModel_placeholder()}
	</button>
{/snippet}

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_titleGenerationModel()}</Label>

	<ModelSelect
		selectedModel={preferencesSettings.titleGenerationModel}
		{trigger}
		onModelSelect={handleModelSelect}
	/>
</div>
