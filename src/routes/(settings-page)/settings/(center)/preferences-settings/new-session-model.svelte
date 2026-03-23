<script lang="ts">
	import { ModelSelect } from "$lib/components/buss/model-select";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { cn } from "$lib/utils";
	import type { Model } from "@shared/types";

	function handleModelSelect(model: Model) {
		preferencesSettings.setNewSessionModel(model);
	}
</script>

{#snippet trigger({ onclick }: { onclick: () => void })}
	<button
		class={cn(
			"h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y text-settings-shortcut-size flex w-full items-center justify-between",
		)}
		{onclick}
	>
		{preferencesSettings.newSessionModel?.name || m.settings_newSessionModelPlaceholder()}
	</button>
{/snippet}

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg font-normal">{m.settings_newSessionModel()}</Label>

	<ModelSelect
		isVibe={false}
		selectedModel={preferencesSettings.newSessionModel}
		{trigger}
		onModelSelect={handleModelSelect}
	/>

	<Label class="text-label-fg font-normal mt-4">{m.settings_vibeNewSessionModel()}</Label>

	<ModelSelect
		isVibe={false}
		selectedModel={preferencesSettings.vibeNewSessionModel}
		onModelSelect={(model) => preferencesSettings.setVibeNewSessionModel(model)}
	>
		{#snippet trigger({ onclick }: { onclick: () => void })}
			<button
				class={cn(
					"h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y text-settings-shortcut-size flex w-full items-center justify-between",
				)}
				{onclick}
			>
				{preferencesSettings.vibeNewSessionModel?.name ||
					m.settings_vibeNewSessionModelPlaceholder()}
			</button>
		{/snippet}
	</ModelSelect>
</div>
