<script lang="ts">
	import { SegButton, SettingSwitchItem } from "$lib/components/buss/settings";
	import { Label } from "$lib/components/ui/label/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { Rabbit, Timer, Zap } from "@lucide/svelte";

	let autoStreamOutput = $state(false);
	let speed = $state("normal");

	const speedOptions = [
		{
			key: "slow",
			label: m.settings_slow(),
			icon: Rabbit,
			iconSize: 16,
		},
		{
			key: "normal",
			label: m.settings_normal(),
			icon: Timer,
			iconSize: 16,
		},
		{
			key: "fast",
			label: m.settings_fast(),
			icon: Zap,
			iconSize: 16,
		},
	];

	function handleSelect(key: string) {
		speed = key;
	}
</script>

<div class="gap-settings-gap flex flex-col">
	<div class="space-y-2">
		<Label class="text-label-fg">{m.settings_streamOutputLabel()}</Label>
		<SettingSwitchItem label={m.settings_streamOutputEnable()} bind:checked={autoStreamOutput} />
	</div>
	{#if autoStreamOutput}
		<div class="space-y-2">
			<Label class="text-label-fg">{m.settings_streamOutputSpeed()}</Label>
			<SegButton options={speedOptions} selectedKey={speed} onSelect={handleSelect} />
		</div>
	{/if}
</div>
