<script lang="ts">
	import { SettingSwitchItem } from "$lib/components/buss/settings";
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import {
		preferencesSettings,
		type SuggestionsTiming,
	} from "$lib/stores/preferences-settings.state.svelte";

	const timingOptions = [
		{ label: m.settings_suggestionsAuto(), value: "auto" },
		{ label: m.settings_suggestionsOff(), value: "off" },
	];

	let suggestionsCount = $state(preferencesSettings.suggestionsCount);

	function handleCountChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const value = parseInt(target.value);
		if (!isNaN(value) && value >= 1 && value <= 5) {
			suggestionsCount = value;
			preferencesSettings.setSuggestionsCount(value);
		}
	}

	function handleCountBlur() {
		// Ensure the value is within bounds on blur
		if (suggestionsCount < 1) {
			suggestionsCount = 1;
			preferencesSettings.setSuggestionsCount(1);
		} else if (suggestionsCount > 5) {
			suggestionsCount = 5;
			preferencesSettings.setSuggestionsCount(5);
		}
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<Label class="text-label-fg">{m.settings_suggestions()}</Label>
	<SettingSwitchItem
		label={m.settings_suggestionsEnable()}
		checked={preferencesSettings.suggestionsEnabled}
		onCheckedChange={(v) => preferencesSettings.setSuggestionsEnabled(v)}
	/>
	{#if preferencesSettings.suggestionsEnabled}
		<div
			class="h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y flex w-full items-center justify-between"
		>
			<span class="text-sm">{m.settings_suggestionsCount()}</span>
			<Input
				type="number"
				min="1"
				max="5"
				value={suggestionsCount}
				oninput={handleCountChange}
				onblur={handleCountBlur}
				class="!bg-settings-bg dark:!bg-settings-bg h-9 w-20 text-center"
			/>
		</div>
		<SettingSelect
			name="suggestionsTiming"
			value={preferencesSettings.suggestionsTiming}
			options={timingOptions}
			onValueChange={(v) => preferencesSettings.setSuggestionsTiming(v as SuggestionsTiming)}
		/>
	{/if}
</div>
