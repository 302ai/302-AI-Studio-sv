<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Separator from "$lib/components/ui/separator/separator.svelte";
	import type { Separator as SeparatorPrimitive } from "bits-ui";

	type OpenUISeparatorProps = Pick<SeparatorPrimitive.RootProps, "orientation" | "decorative"> & {
		class?: string;
	};

	let { props }: ComponentRenderProps<OpenUISeparatorProps> = $props();
</script>

<Separator {...props} />
