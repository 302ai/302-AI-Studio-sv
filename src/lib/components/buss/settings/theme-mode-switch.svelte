<script lang="ts">
	import { cn } from "$lib/utils";
	import { Badge } from "$lib/components/ui/badge";
	import { Code, Palette } from "@lucide/svelte";
	import { m } from "$lib/paraglide/messages.js";
	import { onMount } from "svelte";

	interface Props {
		checked?: boolean;
	}

	let { checked = $bindable(false) }: Props = $props();

	const options = [
		{
			key: "visual",
			icon: Palette,
			label: m.text_theme_visual_editor(),
			badge: { text: m.text_theme_recommended(), variant: "secondary" as const },
		},
		{
			key: "code",
			icon: Code,
			label: m.text_theme_code_editor(),
			badge: { text: m.text_theme_advanced(), variant: "outline" as const },
		},
	];

	let thumbStyle: { left: string; width: string } = $state({ left: "", width: "" });
	let itemElements: HTMLElement[] = $state([]);
	let containerElement: HTMLElement | null = $state(null);

	let selectedKey = $derived(checked ? "code" : "visual");
	let selectedIndex = $derived(options.findIndex((o) => o.key === selectedKey));

	async function updateThumbPosition() {
		if (selectedIndex === -1) return;

		const item = itemElements[selectedIndex];
		const container = containerElement;
		if (!item || !container) return;

		const containerRect = container.getBoundingClientRect();
		const itemRect = item.getBoundingClientRect();

		thumbStyle = {
			left: `${itemRect.left - containerRect.left}px`,
			width: `${itemRect.width}px`,
		};
	}

	$effect(() => {
		if (selectedIndex !== -1) {
			updateThumbPosition();
		}
	});

	onMount(() => {
		updateThumbPosition();
	});

	function handleSelect(key: string) {
		checked = key === "code";
	}
</script>

<div
	bind:this={containerElement}
	class="relative flex h-seg items-center rounded-seg-button-container bg-settings-item-bg px-seg-x"
>
	{#if thumbStyle.left}
		<div
			class="absolute z-1 h-seg-thumb rounded-md bg-accent !transition-all duration-400 ease-in-out"
			style="left: {thumbStyle.left}; width: {thumbStyle.width};"
		></div>
	{/if}

	<div class="flex w-full gap-2">
		{#each options as option, index (option.key)}
			{@const isActive = selectedKey === option.key}
			<button
				bind:this={itemElements[index]}
				class={cn(
					"relative z-2 flex h-seg-thumb flex-1 cursor-pointer items-center justify-center gap-1 rounded-md text-sm",
					isActive ? "text-accent-foreground" : "z-1 text-secondary-foreground hover:bg-tab-hover",
				)}
				type="button"
				onmousedown={() => handleSelect(option.key)}
				aria-pressed={isActive}
			>
				<option.icon class="h-4 w-4" />
				<span>{option.label}</span>
				<Badge variant={option.badge.variant} class="text-xs">{option.badge.text}</Badge>
			</button>
		{/each}
	</div>
</div>
