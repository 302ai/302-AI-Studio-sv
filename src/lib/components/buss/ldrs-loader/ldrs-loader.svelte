<script lang="ts" module>
	export interface LdrsLoaderProps {
		type: "dot-pulse" | "line-spinner" | "waveform";
		size?: number;
		speed?: number;
		color?: string;
		stroke?: number;
	}
</script>

<script lang="ts">
	import { onMount } from "svelte";
	import { match } from "ts-pattern";

	let {
		type,
		size = 30,
		speed = 1,
		color = "currentColor",
		stroke = 2,
	}: LdrsLoaderProps = $props();

	onMount(async () => {
		await match(type)
			.with("dot-pulse", async () => {
				const { dotPulse } = await import("ldrs");
				dotPulse.register();
			})
			.with("line-spinner", async () => {
				const { lineSpinner } = await import("ldrs");
				lineSpinner.register();
			})
			.with("waveform", async () => {
				const { waveform } = await import("ldrs");
				waveform.register();
			})
			.exhaustive();
	});
</script>

{#if type === "dot-pulse"}
	<l-dot-pulse {size} {speed} {color}></l-dot-pulse>
{:else if type === "line-spinner"}
	<l-line-spinner {size} {speed} {color} {stroke}></l-line-spinner>
{:else if type === "waveform"}
	<l-waveform {size} {speed} {color}></l-waveform>
{/if}
