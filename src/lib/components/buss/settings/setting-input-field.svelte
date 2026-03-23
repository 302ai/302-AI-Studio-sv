<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import Input from "$lib/components/ui/input/input.svelte";
	import Label from "$lib/components/ui/label/label.svelte";
	import { cn } from "$lib/utils";
	import { Eye, EyeOff } from "@lucide/svelte";

	interface Props {
		label: string;
		required?: boolean;
		id?: string;
		type?: string;
		placeholder?: string;
		value?: string | number;
		class?: string;
		inputClass?: string;
		disabled?: boolean;
	}

	let {
		label,
		required = false,
		id,
		type,
		placeholder,
		value = $bindable(""),
		class: className,
		inputClass,
		disabled,
	}: Props = $props();

	let showPassword = $state(false);
	let actualType = $derived(type === "password" && showPassword ? "text" : type);
</script>

<div class="flex flex-col gap-2 {className || ''}">
	<Label for={id}>
		{label}
		{#if required}
			<span class="ml-1 text-red-500">*</span>
		{/if}
	</Label>
	<div class="relative">
		<Input
			{id}
			type={actualType}
			{placeholder}
			{disabled}
			bind:value
			class={cn(
				"!bg-settings-item-bg dark:!bg-settings-item-bg rounded-settings-item hover:ring-ring hover:ring-1",
				type === "password" && "pr-10",
				inputClass,
			)}
		/>
		{#if type === "password"}
			<Button
				variant="ghost"
				size="sm"
				type="button"
				class="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
				{disabled}
				onclick={() => (showPassword = !showPassword)}
			>
				{#if showPassword}
					<EyeOff class="h-4 w-4" />
				{:else}
					<Eye class="h-4 w-4" />
				{/if}
			</Button>
		{/if}
	</div>
</div>
