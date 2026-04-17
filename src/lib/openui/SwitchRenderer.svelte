<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Switch from "$lib/components/ui/switch/switch.svelte";
	import type { Switch as SwitchPrimitive } from "bits-ui";

	type OpenUISwitchProps = Pick<
		SwitchPrimitive.RootProps,
		"checked" | "disabled" | "required" | "name" | "value"
	> & {
		class?: string;
	};

	let { props }: ComponentRenderProps<OpenUISwitchProps> = $props();
</script>

<Switch {...props} />
