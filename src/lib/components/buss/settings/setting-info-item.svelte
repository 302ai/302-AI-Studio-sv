<script lang="ts" module>
	import type { Snippet } from "svelte";

	interface Props {
		label: string;
		value?: string;
		class?: string;
		action?: Snippet;
	}
</script>

<script lang="ts">
	import { Label } from "$lib/components/ui/label/index.js";
	import { cn } from "$lib/utils";

	let { label, value, class: className, action }: Props = $props();
</script>

<div
	class={cn(
		"flex h-settings-item w-full items-center justify-between rounded-settings-item bg-settings-item-bg px-settings-item-x py-settings-item-y",
		className,
	)}
>
	<div class="flex items-center gap-2">
		<Label class="text-sm">{label}</Label>
		{#if value}
			<Label class="text-sm text-muted-foreground">{value}</Label>
		{/if}
	</div>
	{#if action}
		{@render action()}
	{/if}
</div>
