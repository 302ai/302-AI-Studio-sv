<script lang="ts">
	import { SettingSelect } from "$lib/components/buss/settings";
	import { getBuiltinPresets, PRESET_SYSTEM_PROMPT_KEYS } from "$lib/constants/preset-phrasing";
	import { Label } from "$lib/components/ui/label/index.js";
	import { customPresetsStore } from "$lib/stores/custom-presets-store.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { m } from "$lib/paraglide/messages";

	const builtinPresets = $derived(getBuiltinPresets());

	const allPresets = $derived.by(() => {
		const builtinKeys = new Set<string>(PRESET_SYSTEM_PROMPT_KEYS);
		const customOnly = customPresetsStore.presets.filter((p) => !builtinKeys.has(p.key));
		return [...builtinPresets, ...customOnly];
	});

	const currentDefaultPhrasing = $derived(preferencesSettings.defaultPhrasing);

	function handleValueChange(value: string) {
		preferencesSettings.setDefaultPhrasing(value);
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<Label id="defaultPhrasing" class="text-label-fg text-sm">{m.phrasing_default_label()}</Label>
	<SettingSelect
		name="defaultPhrasing"
		value={currentDefaultPhrasing}
		options={allPresets.map((item) => ({
			key: item.key,
			label: item.name,
			value: item.key,
		}))}
		placeholder={m.phrasing_default_placeholder()}
		onValueChange={handleValueChange}
	/>
</div>
