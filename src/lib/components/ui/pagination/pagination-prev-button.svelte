<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: PaginationPrimitive.PrevButtonProps = $props();
</script>

{#snippet Fallback()}
	<ChevronLeftIcon class="size-4" />
	<span>{m.title_previous_page()}</span>
{/snippet}

<PaginationPrimitive.PrevButton
	bind:ref
	aria-label={m.title_previous_page()}
	class={cn(
		buttonVariants({
			size: "default",
			variant: "ghost",
			class: "gap-1 px-2.5 sm:pl-2.5",
		}),
		className,
	)}
	children={children || Fallback}
	{...restProps}
/>
