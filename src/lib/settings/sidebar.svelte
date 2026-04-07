<script lang="ts" module>
	interface Props {
		className?: string;
		items: SidebarItem[];
	}

	export interface SidebarItem {
		name: string;
		path: string;
		labelKey: string;
	}
</script>

<script lang="ts">
	/**
	 *Description: sidebar
	 *Assisted: Qwen3.6 Plus
	 *Author: Leessmin
	 *Date: 2026-04-01
	 **/

	import { goto } from "$app/navigation";
	import { page } from "$app/state";
	import { cn } from "$lib/utils";
	import { onMount } from "svelte";

	let { items, className }: Props = $props();

	let indicatorStyle: { top: string; height: string } = $state({ top: "", height: "" });
	const itemElements: HTMLElement[] = $state([]);
	let containerElement: HTMLElement | null = $state(null);

	function isActiveTab(itemPath: string): boolean {
		return page.url.pathname.startsWith(itemPath);
	}

	const selectedIndex = $derived(items.findIndex((item) => isActiveTab(item.path)));

	async function updateIndicatorPosition() {
		if (selectedIndex === -1) return;

		const item = itemElements[selectedIndex];
		const container = containerElement;
		if (!item || !container) return;

		const containerRect = container.getBoundingClientRect();
		const itemRect = item.getBoundingClientRect();

		indicatorStyle = {
			top: `${itemRect.top - containerRect.top + itemRect.height / 2 - 8}px`,
			height: `16px`,
		};
	}

	$effect(() => {
		if (selectedIndex !== -1) {
			updateIndicatorPosition();
		}
	});

	onMount(() => {
		updateIndicatorPosition();
	});
</script>

<!-- "bg-settings-sidebar-bg flex h-full w-auto min-w-[var(--setting-width)] justify-end" -->
<div class={`${className} flex h-full w-auto min-w-[var(--setting-width)] justify-end`}>
	<div class="flex w-full justify-end p-3">
		<div
			bind:this={containerElement}
			class="relative flex w-full flex-col gap-y-1 border-none"
			role="tablist"
		>
			{#if indicatorStyle.top && selectedIndex !== -1}
				<div
					class="bg-primary absolute right-[-12px] z-10 w-[5px] rounded-none transition-all duration-300 ease-in-out"
					style="top: {indicatorStyle.top}; height: {indicatorStyle.height};"
					data-selected-indicator
				></div>
			{/if}

			{#each items as item, index (item.name)}
				{@const isSelected = isActiveTab(item.path)}
				<a
					bind:this={itemElements[index]}
					href={item.path}
					draggable="false"
					class={cn(
						"px-settings-item-x py-settings-item-y flex w-full items-center rounded-lg text-sm font-medium whitespace-nowrap outline-hidden transition-colors",
						isSelected
							? "text-accent-fg bg-accent"
							: "text-foreground bg-tab-inactive hover:bg-tab-hover",
					)}
					role="tab"
					aria-selected={isSelected}
					tabindex={isSelected ? 0 : -1}
					onclick={(e) => {
						e.preventDefault();
						goto(item.path);
					}}
				>
					<span class="w-full text-right">{item.labelKey}</span>
				</a>
			{/each}
		</div>
	</div>
</div>
