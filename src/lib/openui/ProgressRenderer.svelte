<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Progress from "$lib/components/ui/progress/progress.svelte";
	import type { Progress as ProgressPrimitive } from "bits-ui";

	type OpenUIProgressProps = Pick<ProgressPrimitive.RootProps, "max" | "value"> & {
		class?: string;
	};

	let { props }: ComponentRenderProps<OpenUIProgressProps> = $props();
</script>

<Progress {...props} />
