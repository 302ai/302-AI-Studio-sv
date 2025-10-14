<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { X } from "@lucide/svelte";
	import * as m from "$lib/paraglide/messages.js";

	interface KeyValuePair {
		key: string;
		value: string;
		id: string;
	}

	interface Props {
		label: string;
		addButtonLabel?: string;
		keyPlaceholder?: string;
		valuePlaceholder?: string;
		items?: KeyValuePair[];
		onAdd?: () => void;
		onRemove?: (id: string) => void;
	}

	let {
		label,
		addButtonLabel = m.mcp_kv_add(),
		keyPlaceholder = m.mcp_kv_key_placeholder(),
		valuePlaceholder = m.mcp_kv_value_placeholder(),
		items = $bindable([]),
		onAdd,
		onRemove,
	}: Props = $props();
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between">
		<Label>{label}</Label>
		<button type="button" class="text-primary cursor-pointer text-sm" onclick={onAdd}>
			{addButtonLabel}
		</button>
	</div>
	{#each items as item (item.id)}
		<div class="flex items-center gap-2">
			<Input
				bind:value={item.key}
				placeholder={keyPlaceholder}
				class="bg-white dark:bg-[#121212] flex-1 rounded-settings-item"
			/>
			<Input
				bind:value={item.value}
				placeholder={valuePlaceholder}
				class="bg-white dark:bg-[#121212] flex-[2] rounded-settings-item"
			/>
			<Button size="icon-sm" variant="ghost" onclick={() => onRemove?.(item.id)}>
				<X class="h-4 w-4" />
			</Button>
		</div>
	{/each}
</div>
