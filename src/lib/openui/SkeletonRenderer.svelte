<script lang="ts">
	import type { ComponentRenderProps } from "@openuidev/svelte-lang";
	import Skeleton from "$lib/components/ui/skeleton/skeleton.svelte";

	type OpenUISkeletonProps = {
		class?: string;
	};

	let { props }: ComponentRenderProps<OpenUISkeletonProps> = $props();
</script>

<Skeleton {...props} />
