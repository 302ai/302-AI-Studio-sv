<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import type { WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: className,
		children,
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<nav
	bind:this={ref}
	data-slot="breadcrumb"
	class={className}
	aria-label={m.title_breadcrumb()}
	{...restProps}
>
	{@render children?.()}
</nav>
