<script lang="ts">
	import Input from "$lib/components/ui/input/input.svelte";
	import { cn } from "$lib/utils";
	import { Search } from "@lucide/svelte";

	interface Props {
		value?: string;
		placeholder?: string;
		class?: string;
		oninput?: (event: Event & { currentTarget: EventTarget & HTMLInputElement }) => void;
	}

	let { value = $bindable(""), placeholder, class: className, oninput }: Props = $props();
</script>

<div class={cn("relative flex w-full items-center", className)}>
	<div class="pointer-events-none absolute left-3 flex items-center">
		<Search class="text-muted-foreground size-4" />
	</div>
	<Input
		bind:value
		type="text"
		{placeholder}
		{oninput}
		class="rounded-settings-item !bg-settings-item-bg hover:ring-ring hover:ring-1 h-settings-item pl-10"
	/>
</div>
