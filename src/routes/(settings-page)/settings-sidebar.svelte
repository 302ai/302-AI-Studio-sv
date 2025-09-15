<script lang="ts">
	import { page } from "$app/state";
	import { m } from "$lib/paraglide/messages.js";
	import { cn } from "$lib/utils";
	import { onMount } from "svelte";

	const items = [
		{
			name: "general-settings",
			path: "/settings/general-settings",
			labelKey: m.text_button_settings_general(),
		},
		{
			name: "preferences-settings",
			path: "/settings/preferences-settings",
			labelKey: m.text_button_settings_preferences(),
		},
		{
			name: "theme-settings",
			path: "/settings/theme-settings",
			labelKey: m.text_button_settings_theme(),
		},
		{
			name: "model-settings",
			path: "/settings/model-settings",
			labelKey: m.text_button_settings_models(),
		},
		{
			name: "data-settings",
			path: "/settings/data-settings",
			labelKey: m.text_button_settings_data(),
		},
		{
			name: "shortcut-settings",
			path: "/settings/shortcut-settings",
			labelKey: m.text_button_settings_shortcuts(),
		},
	];

	let indicatorStyle: { top: string; height: string } = $state({ top: "", height: "" });
	let itemElements: HTMLElement[] = $state([]);
	let containerElement: HTMLElement | null = $state(null);

	function isActiveTab(itemPath: string): boolean {
		return page.url.pathname.startsWith(itemPath);
	}

	let selectedIndex = $derived(items.findIndex((item) => isActiveTab(item.path)));

	async function updateIndicatorPosition() {
		if (selectedIndex === -1) return;

		const item = itemElements[selectedIndex];
		const container = containerElement;
		if (!item || !container) return;

		const containerRect = container.getBoundingClientRect();
		const itemRect = item.getBoundingClientRect();

		indicatorStyle = {
			top: `${itemRect.top - containerRect.top + itemRect.height / 2 - 8}px`, // 8px = h-4 / 2
			height: `16px`, // h-4
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

<div class="bg-setting flex h-full w-auto min-w-[var(--setting-width)] justify-end">
	<div class="flex w-full justify-end p-3">
		<div
			bind:this={containerElement}
			class="relative flex w-full flex-col gap-y-1 border-none"
			role="tablist"
			aria-label="Settings Navigation"
		>
			{#if indicatorStyle.top && selectedIndex !== -1}
				<div
					class="absolute right-[-12px] z-10 w-[5px] rounded-none bg-primary transition-all duration-300 ease-in-out"
					style="top: {indicatorStyle.top}; height: {indicatorStyle.height};"
					data-selected-indicator
				></div>
			{/if}

			{#each items as item, index (item.name)}
				{@const isSelected = isActiveTab(item.path)}
				<a
					bind:this={itemElements[index]}
					href={item.path}
					class={cn(
						"flex w-full items-center rounded-lg px-settings-item-x py-settings-item-y text-sm font-medium whitespace-nowrap outline-hidden transition-colors",
						"hover:bg-hover-primary",
						isSelected ? "text-accent-fg bg-accent" : "text-foreground",
					)}
					role="tab"
					aria-selected={isSelected}
					tabindex={isSelected ? 0 : -1}
				>
					<span class="w-full text-right">{item.labelKey}</span>
				</a>
			{/each}
		</div>
	</div>
</div>
