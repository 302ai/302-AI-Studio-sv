<script lang="ts">
	import { cn } from "$lib/utils";
	import { onMount, type Component, type Snippet } from "svelte";

	export interface SegmentedOption {
		key: string;
		icon?: Component;
		iconSnippet?: Snippet;
		label: string;
		description?: string;
		iconSize?: number;
		disabled?: boolean;
		tooltip?: string;
	}

	interface Props {
		options: SegmentedOption[];
		selectedKey: string | null;
		onSelect: (key: string) => void;
		disabled?: boolean;
		class?: string;
		thumbClass?: string;
		leftThumbClass?: string;
		activeThumbClass?: string;
		contentClass?: string;
	}

	let {
		options,
		selectedKey,
		onSelect,
		disabled,
		class: className,
		thumbClass,
		leftThumbClass,
		activeThumbClass,
		contentClass,
	}: Props = $props();

	let thumbStyle: { left: string; width: string } = $state({ left: "", width: "" });
	const itemElements: HTMLElement[] = $state([]);
	let containerElement: HTMLElement | null = $state(null);

	const selectedIndex = $derived(options.findIndex((o) => o.key === selectedKey));

	async function updateThumbPosition() {
		if (selectedIndex === -1) return;

		const item = itemElements[selectedIndex];
		if (!item) return;

		thumbStyle = {
			left: `${item.offsetLeft}px`,
			width: `${item.offsetWidth}px`,
		};
	}

	$effect(() => {
		if (selectedIndex !== -1) {
			updateThumbPosition();
		}
	});

	onMount(() => {
		updateThumbPosition();
		if (containerElement) {
			const observer = new ResizeObserver(() => {
				updateThumbPosition();
			});
			observer.observe(containerElement);
			return () => observer.disconnect();
		}
	});

	function handleSelect(key: string) {
		if (disabled) return;
		const option = options.find((o) => o.key === key);
		if (option?.disabled) {
			return;
		}
		onSelect(key);
	}
</script>

<div
	bind:this={containerElement}
	class={cn(
		"h-seg rounded-seg-button-container bg-settings-item-bg px-seg-x relative flex items-center",
		className,
	)}
>
	{#if thumbStyle.left}
		<div
			class={cn(
				"h-seg-thumb bg-accent absolute z-1 rounded-md transition-all duration-400 ease-in-out",
				thumbClass,
				leftThumbClass,
			)}
			style="left: {thumbStyle.left}; width: {thumbStyle.width};"
		></div>
	{/if}

	<div class={cn("flex w-full gap-2", contentClass)}>
		{#each options as option, index (option.key)}
			{@const isActive = selectedKey === option.key}
			<button
				bind:this={itemElements[index]}
				class={cn(
					"h-seg-thumb relative z-2 flex flex-1  items-center justify-center gap-1 rounded-md text-sm",
					option.disabled || disabled
						? "cursor-not-allowed opacity-50"
						: "cursor-pointer",
					isActive
						? activeThumbClass || "text-accent-foreground"
						: "text-secondary-foreground hover:bg-tab-hover z-1",
					thumbClass,
				)}
				type="button"
				onmousedown={() => handleSelect(option.key)}
				aria-pressed={isActive}
			>
				<div class="flex flex-col items-center justify-center">
					<div class="flex items-center justify-center gap-1">
						{#if option.iconSnippet}
							{@render option.iconSnippet()}
						{:else if option.icon}
							<option.icon size={option.iconSize} />
						{/if}
						{#if option.label}
							<span>{option.label}</span>
						{/if}
					</div>
					{#if option.description}
						<span class="text-[10px] opacity-60 leading-tight"
							>{option.description}</span
						>
					{/if}
				</div>
			</button>
		{/each}
	</div>
</div>
