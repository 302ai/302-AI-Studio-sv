<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import { cn } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: PaginationPrimitive.NextButtonProps = $props();
</script>

{#snippet Fallback()}
	<span>{m.title_next_page()}</span>
	<ChevronRightIcon class="size-4" />
{/snippet}

<PaginationPrimitive.NextButton
	bind:ref
	aria-label={m.title_next_page()}
	class={cn(
		buttonVariants({
			size: "default",
			variant: "ghost",
			class: "gap-1 px-2.5 sm:pr-2.5",
		}),
		className,
	)}
	children={children || Fallback}
	{...restProps}
/>
