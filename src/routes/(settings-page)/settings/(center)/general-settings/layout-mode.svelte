<script lang="ts">
	import type { SelectOption } from "$lib/components/buss/settings/setting-select.svelte";
	import SettingSelect from "$lib/components/buss/settings/setting-select.svelte";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";

	const layouts = [
		{
			key: "default",
			label: m.label_button_default(),
			value: "default",
		},
		{
			key: "wide",
			label: m.label_button_wide(),
			value: "wide",
		},
		{
			key: "ultraWide",
			label: m.label_button_ultra_wide(),
			value: "ultra-wide",
		},
	];

	let value = $state("default");

	const options: SelectOption[] = layouts.map((layout) => ({
		key: layout.key,
		label: layout.label,
		value: layout.value,
	}));
</script>

<div class="flex flex-col gap-settings-gap">
	<Label id="layout" class="text-label-fg">{m.layout()}</Label>
	<SettingSelect name="layout" bind:value {options} />
</div>
