<script lang="ts" module>
	/**
	 *Description: General Navigation Bar
	 *Assisted: Qwen3.6 Plus
	 *Author: Leessmin
	 *Date: 2026-04-02
	 **/

	import type { Snippet } from "svelte";
	import type { DndEvent } from "svelte-dnd-action";
	import type { DndItem } from "./types";

	interface Props<T extends DndItem> {
		items: T[];
		activeId?: string;
		onItemClick?: (item: T) => void;
		onReorder?: (items: T[]) => void;
		class?: string;
		"aria-label"?: string;
		children: Snippet<[item: T, isActive: boolean]>;
	}

	const ANIMATION_CONSTANTS = {
		APPEAR_DELAY: 120,
		BOUNCE_INTENSITY: 20,
		BOUNCE_DURATION: 200,
		SPRING_CONFIG: { stiffness: 0.2, damping: 0.7 },
	} as const;

	type ItemDndEvent<T extends DndItem> = DndEvent<T>;
</script>

<script lang="ts" generics="T extends DndItem">
	import { cn } from "$lib/utils";
	import { onDestroy } from "svelte";
	import { dndzone, TRIGGERS } from "svelte-dnd-action";
	import { flip } from "svelte/animate";
	import { scale } from "svelte/transition";

	let {
		items = $bindable<T[]>(),
		activeId = $bindable<string>(),
		onItemClick,
		onReorder,
		class: className,
		"aria-label": ariaLabel,
		children: renderItem,
	}: Props<T> = $props();

	let draggedElementId = $state<string | null>(null);
	let isDndFinalizing = $state(false);

	function handleDndConsider(e: CustomEvent<ItemDndEvent<T>>) {
		const { info, items: newItems } = e.detail;

		if (info.trigger === TRIGGERS.DRAG_STARTED) {
			draggedElementId = info.id;

			const draggedItem = items.find((item) => item.id === info.id);
			if (draggedItem) {
				onItemClick?.(draggedItem);
			}
		}

		const hasOrderChanged = newItems.some((item, index) => item.id !== items[index]?.id);
		if (hasOrderChanged) items = newItems;
	}

	function handleDndFinalize(e: CustomEvent<ItemDndEvent<T>>) {
		isDndFinalizing = true;

		try {
			draggedElementId = null;
			items = e.detail.items;

			onReorder?.(e.detail.items);
		} catch (error) {
			console.error("Error finalizing drag operation:", error);
		} finally {
			queueMicrotask(() => {
				isDndFinalizing = false;
			});
		}
	}

	function transformDraggedElement(element?: HTMLElement) {
		if (!element) return;

		try {
			element.style.outline = "none";

			const itemElement = element.querySelector('[role="button"]') as HTMLElement;
			itemElement?.classList.add("bg-tab-active", "text-tab-fg-active", "shadow-sm");
			itemElement?.classList.remove(
				"bg-tab-inactive",
				"text-tab-fg-inactive",
				"hover:bg-tab-hover",
			);
		} catch (error) {
			console.warn("Error transforming dragged element:", error);
		}
	}

	onDestroy(() => {
		window.cancelAnimationFrame?.(0);
	});
</script>

<div class={cn("flex w-full flex-col", className)} role="list" aria-label={ariaLabel}>
	<div
		class="gap-provider-list-gap flex h-full w-full flex-col"
		use:dndzone={{
			items,
			flipDurationMs: 200,
			dropTargetStyle: {},
			transformDraggedElement,
			morphDisabled: true,
			autoAriaDisabled: false,
			zoneTabIndex: 0,
			zoneItemTabIndex: 0,
		}}
		onconsider={handleDndConsider}
		onfinalize={handleDndFinalize}
	>
		{#each items as item (item.id)}
			<div
				class="flex w-full min-w-0 items-center"
				data-id={item.id}
				role="presentation"
				aria-label={item.id}
				animate:flip={{ duration: 200 }}
				in:scale={draggedElementId || isDndFinalizing
					? { duration: 0 }
					: {
							duration: 250,
							start: 0.8,
							delay: ANIMATION_CONSTANTS.APPEAR_DELAY,
						}}
				out:scale={draggedElementId || isDndFinalizing
					? { duration: 0 }
					: { duration: 200, start: 0.8 }}
			>
				{@render renderItem(item, item.id === activeId)}
			</div>
		{/each}
	</div>
</div>
