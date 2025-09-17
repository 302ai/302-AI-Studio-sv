<script lang="ts" module>
	import type { DndEvent } from "svelte-dnd-action";
	import { type Tab } from "./tab-item.svelte";

	interface Props {
		tabs: Tab[];
		activeTabId: string;
		onTabClick: (tab: Tab) => void;
		onTabClose: (tab: Tab) => void;
		onTabCloseAll: () => void;
		onNewTab: () => void;
		class?: string;
		autoStretch?: boolean;
	}

	const ANIMATION_CONSTANTS = {
		TAB_APPEAR_DELAY: 120,
		BOUNCE_INTENSITY: 20,
		BOUNCE_DURATION: 200,
		SPRING_CONFIG: { stiffness: 0.2, damping: 0.7 },
	} as const;

	type TabDndEvent = DndEvent<Tab>;
</script>

<script lang="ts">
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { cn } from "$lib/utils";
	import { animateButtonBounce } from "$lib/utils/animation";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { Plus } from "@lucide/svelte";
	import { onDestroy } from "svelte";
	import { dndzone, TRIGGERS } from "svelte-dnd-action";
	import { flip } from "svelte/animate";
	import { Spring } from "svelte/motion";
	import { scale } from "svelte/transition";
	import TabItem from "./tab-item.svelte";

	let {
		tabs = $bindable<Tab[]>(),
		activeTabId = $bindable<string>(),
		onTabClick,
		onTabClose,
		onTabCloseAll,
		onNewTab,
		class: className,
		autoStretch = false,
	}: Props = $props();

	let draggedElementId = $state<string | null>(null);
	const buttonSpring = new Spring({ opacity: 1, x: 0 }, { stiffness: 0.2, damping: 0.8 });
	const buttonBounceSpring = new Spring({ x: 0 }, { stiffness: 0.4, damping: 0.6 });

	let previousTabsLength = $state(tabs.length);
	let isAnimating = $state(false);
	let isDndFinalizing = $state(false);

	const tabsCountDiff = $derived(tabs.length - previousTabsLength);
	const shouldAnimateCloseTab = $derived(tabsCountDiff < 0 && !isAnimating);

	function handleNewTab() {
		if (isAnimating) return;

		isAnimating = true;
		onNewTab();

		animateButtonBounce(buttonBounceSpring, "new").then(() => {
			isAnimating = false;
		});
	}

	$effect(() => {
		if (shouldAnimateCloseTab) {
			animateButtonBounce(buttonBounceSpring, "close");
		}
		previousTabsLength = tabs.length;
	});

	function handleDndConsider(e: CustomEvent<TabDndEvent>) {
		const { info, items: newItems } = e.detail;

		if (info.trigger === TRIGGERS.DRAG_STARTED) {
			draggedElementId = info.id;
			buttonSpring.target = { opacity: 0.3, x: 8 };
			const draggedTab = tabs.find((tab) => tab.id === info.id);
			if (draggedTab) {
				onTabClick(draggedTab);
			}
		}

		const hasOrderChanged = newItems.some((item, index) => item.id !== tabs[index]?.id);
		if (hasOrderChanged) tabs = newItems;
	}
	function handleDndFinalize(e: CustomEvent<TabDndEvent>) {
		isDndFinalizing = true;

		try {
			draggedElementId = null;
			tabs = e.detail.items;
			buttonSpring.target = { opacity: 1, x: 0 };
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

			const tabElement = element.querySelector('[role="button"]') as HTMLElement;
			tabElement?.classList.remove("hover:bg-tab-hover");
			tabElement?.classList.add("bg-tab-active", "text-tab-fg-active", "shadow-sm");
			tabElement?.classList.remove("bg-tab-inactive", "text-tab-fg-inactive");
		} catch (error) {
			console.warn("Error transforming dragged element:", error);
		}
	}
	onDestroy(() => {
		buttonSpring.target = { opacity: 1, x: 0 };
		buttonBounceSpring.target = { x: 0 };

		window.cancelAnimationFrame?.(0);
	});
</script>

<div
	class={cn("h-tabbar bg-tabbar-bg/50 flex w-full items-center border-b", className)}
	role="tablist"
	style="app-region: drag;"
	aria-label={m.label_button_new_tab() ?? "Tab bar"}
>
	<div
		class="gap-tab-gap px-tabbar-x flex w-full min-w-0 items-center overflow-x-hidden"
		use:dndzone={{
			items: tabs,
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
		{#each tabs as tab, index (tab.id)}
			{@const isCurrentActive = tab.id === activeTabId}
			{@const nextTab = tabs[index + 1]}
			{@const isNextActive = nextTab?.id === activeTabId}
			{@const isLastTab = index === tabs.length - 1}
			{@const shouldShowSeparator = !isLastTab && !isCurrentActive && !isNextActive}
			<div
				class={cn("flex min-w-0 items-center", autoStretch && "flex-1 basis-0")}
				data-id={tab.id}
				role="presentation"
				aria-label={tab.title}
				animate:flip={{ duration: 200 }}
				in:scale={draggedElementId || isDndFinalizing
					? { duration: 0 }
					: { duration: 250, start: 0.8, delay: ANIMATION_CONSTANTS.TAB_APPEAR_DELAY }}
				out:scale={draggedElementId || isDndFinalizing
					? { duration: 0 }
					: { duration: 200, start: 0.8 }}
			>
				<TabItem
					{tab}
					isActive={isCurrentActive}
					isDragging={draggedElementId === tab.id}
					stretch={autoStretch}
					{onTabClick}
					{onTabClose}
					{onTabCloseAll}
				/>
				<div class="shrink-0 px-0.5" style="cursor: pointer !important;">
					<Separator
						orientation="vertical"
						class="!h-[20px] !w-0.5 transition-opacity duration-200 {shouldShowSeparator
							? 'opacity-30'
							: 'opacity-0'}"
					/>
				</div>
			</div>
		{/each}

		<div
			class="flex shrink-0 items-center"
			style="opacity: {buttonSpring.current.opacity}; transform: translateX({buttonSpring.current
				.x + buttonBounceSpring.current.x}px);"
		>
			<Separator
				orientation="vertical"
				class={cn("mx-0.5 !h-[20px] !w-0.5", tabs.length === 0 ? "opacity-0" : "opacity-100")}
				style="cursor: none !important;"
			/>
			<ButtonWithTooltip
				tooltip={m.label_button_new_tab()}
				tooltipSide="bottom"
				variant="ghost"
				size="icon"
				class="size-tab-new hover:!bg-tab-btn-hover-inactive bg-transparent transition-colors"
				style="app-region: no-drag;"
				onclick={handleNewTab}
			>
				<Plus class="size-tab-icon" />
			</ButtonWithTooltip>
		</div>
	</div>
</div>
