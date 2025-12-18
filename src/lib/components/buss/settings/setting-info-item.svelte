<script lang="ts" module>
	import type { Snippet } from "svelte";

	interface Props {
		label: string;
		value?: string;
		class?: string;
		action?: Snippet;
		isBold?: boolean;
	}
</script>

<script lang="ts">
	import { Label } from "$lib/components/ui/label/index.js";
	import { cn } from "$lib/utils";

	const { label, value, class: className, action, isBold }: Props = $props();
</script>

<div
	class={cn(
		"h-settings-item rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y flex w-full items-center justify-between",
		className,
	)}
>
	<div class="flex items-center gap-2">
		<Label class="text-sm font-normal">{label}</Label>
		{#if value}
			{#if isBold}
				<Label class="text-sm font-semibold truncate">{value}</Label>
			{:else}
				<Label class="text-label-fg font-normal">{value}</Label>
			{/if}
		{/if}
	</div>
	{#if action}
		{@render action()}
	{/if}
</div>
