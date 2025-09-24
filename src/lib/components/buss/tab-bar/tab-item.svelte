<script lang="ts" module>
	interface Props {
		tab: Tab;
		isActive: boolean;
		isDragging?: boolean;
		stretch?: boolean;
		closable: boolean;
		onTabClick: (tab: Tab) => void;
		onTabClose: (tab: Tab) => void;
		onTabCloseAll: () => void;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	}

	const COMPACT_THRESHOLD_PX = 64;
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import * as ContextMenu from "$lib/components/ui/context-menu/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { cn } from "$lib/utils";
	import { CircleX, Ghost, MessageCircle, Settings, X } from "@lucide/svelte";
	import type { Tab } from "@shared/types";
	import { onDestroy } from "svelte";

	const {
		tab,
		isActive,
		isDragging: _isDragging = false,
		stretch = false,
		closable,
		onTabClick,
		onTabClose,
		onTabCloseAll,
		onOpenChange,
		class: className,
	}: Props = $props();

	let triggerRef = $state<HTMLElement | null>(null);
	let isCompact = $state(false);

	$effect(() => {
		if (!triggerRef?.parentElement) return;

		try {
			const ro = new ResizeObserver((entries) => {
				requestAnimationFrame(() => {
					const entry = entries[0];
					if (entry?.contentRect) {
						isCompact = entry.contentRect.width < COMPACT_THRESHOLD_PX;
					}
				});
			});

			ro.observe(triggerRef.parentElement);
			return () => ro.disconnect();
		} catch (error) {
			console.warn("Error setting up ResizeObserver:", error);
			const width = triggerRef.parentElement.clientWidth;
			isCompact = width < COMPACT_THRESHOLD_PX;
			return;
		}
	});

	onDestroy(() => {
		window.cancelAnimationFrame?.(0);
	});
</script>

{#snippet tabIcon()}
	{@const tabType = tab.type}
	{#if tabType === "chat"}
		{#if tab.incognitoMode}
			<Ghost />
		{:else}
			<MessageCircle />
		{/if}
	{:else if tabType === "settings"}
		<Settings />
	{/if}
{/snippet}

<ContextMenu.Root {onOpenChange}>
	<ContextMenu.Trigger
		class={cn(
			"h-tab rounded-tab px-tab-x relative flex cursor-pointer items-center text-sm",
			isCompact ? "justify-center" : "gap-tab-gap justify-between",
			stretch ? "min-w-tab-min-w w-auto" : "w-tab-w",
			isActive
				? "bg-tab-active text-tab-fg-active"
				: "bg-tab-inactive text-tab-fg-inactive hover:bg-tab-hover border-transparent",
			"overflow-hidden",
			className,
		)}
		style="app-region: no-drag;"
		onclick={() => onTabClick(tab)}
		role="button"
		tabindex={0}
	>
		<div bind:this={triggerRef} class="contents">
			<div class="mr-tab-icon size-tab-item-icon flex shrink-0 items-center justify-center">
				{@render tabIcon()}
			</div>

			{#if !isCompact}
				<span class="max-w-tab-title min-w-0 flex-1 truncate">{tab.title}</span>
			{/if}
			{#if closable}
				<ButtonWithTooltip
					tooltip={isCompact ? tab.title : m.label_button_close()}
					tooltipSide="bottom"
					variant="ghost"
					size="icon"
					class={cn(
						"p-tab-close h-auto w-auto shrink-0 rounded bg-transparent transition-colors",
						isActive
							? "hover:bg-tab-btn-hover-active dark:hover:bg-tab-btn-hover-active"
							: "hover:bg-tab-btn-hover-inactive hover:text-tab-btn-hover-fg dark:hover:bg-tab-btn-hover-inactive",
					)}
					onclick={(e) => {
						e.stopPropagation();
						onTabClose(tab);
					}}
					{onOpenChange}
				>
					<X class="size-tab-close-icon" />
				</ButtonWithTooltip>
			{/if}
		</div>
	</ContextMenu.Trigger>
	<ContextMenu.Content class="w-48">
		<ContextMenu.Item onclick={() => onTabClose(tab)} disabled={!closable}>
			<X class="mr-2 h-4 w-4" />
			{m.label_button_close()}
		</ContextMenu.Item>
		<ContextMenu.Item onclick={() => onTabCloseAll()} disabled={!closable}>
			<CircleX class="mr-2 h-4 w-4" />
			{m.label_button_close_all()}
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
