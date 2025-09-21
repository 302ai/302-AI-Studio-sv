<script lang="ts" module>
	import type { DndEvent } from "svelte-dnd-action";

	interface Props {
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
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { cn } from "$lib/utils";
	import { animateButtonBounce } from "$lib/utils/animation";
	import { Plus } from "@lucide/svelte";
	import type { Tab } from "@shared/types";
	import { onDestroy, onMount } from "svelte";
	import { dndzone, TRIGGERS } from "svelte-dnd-action";
	import { flip } from "svelte/animate";
	import { Spring } from "svelte/motion";
	import { scale } from "svelte/transition";
	import TabItem from "./tab-item.svelte";

	const { deviceService } = window.electronAPI;

	let { class: className, autoStretch = false }: Props = $props();

	let draggedElementId = $state<string | null>(null);
	const buttonSpring = new Spring({ opacity: 1, x: 0 }, { stiffness: 0.2, damping: 0.8 });
	const buttonBounceSpring = new Spring({ x: 0 }, { stiffness: 0.4, damping: 0.6 });

	let previousTabsLength = $state(tabBarState.tabs.length);
	let isAnimating = $state(false);
	let isDndFinalizing = $state(false);
	let isMac = $state(false);

	const tabsCountDiff = $derived(tabBarState.tabs.length - previousTabsLength);
	const shouldAnimateCloseTab = $derived(tabsCountDiff < 0 && !isAnimating);
	const closable = $derived(previousTabsLength > 1);

	// Debug: Check for duplicate IDs
	$effect(() => {
		const ids = tabBarState.tabs.map((tab) => tab.id);
		const uniqueIds = new Set(ids);
		if (ids.length !== uniqueIds.size) {
			console.error("Duplicate tab IDs detected:", ids);
			console.error("Tabs:", tabBarState.tabs);
			// Fix duplicate IDs by ensuring uniqueness
			const seen = new Set<string>();
			tabBarState.updatePersistedTabs(
				tabBarState.tabs.filter((tab) => {
					if (seen.has(tab.id)) {
						console.warn(`Removing duplicate tab with ID: ${tab.id}`);
						return false;
					}
					seen.add(tab.id);
					return true;
				}),
			);
		}
	});

	function handleNewTab() {
		if (isAnimating) return;

		isAnimating = true;
		tabBarState.handleNewTab();

		animateButtonBounce(buttonBounceSpring, "new").then(() => {
			isAnimating = false;
		});
	}

	$effect(() => {
		if (shouldAnimateCloseTab) {
			animateButtonBounce(buttonBounceSpring, "close");
		}
		previousTabsLength = tabBarState.tabs.length;
	});

	function handleDndConsider(e: CustomEvent<TabDndEvent>) {
		const { info, items: newItems } = e.detail;

		if (info.trigger === TRIGGERS.DRAG_STARTED) {
			draggedElementId = info.id;
			buttonSpring.target = { opacity: 0.3, x: 8 };
			const draggedTab = tabBarState.tabs.find((tab) => tab.id === info.id);
			if (draggedTab) {
				tabBarState.handleTabClick(draggedTab);
			}
		}

		const hasOrderChanged = newItems.some((item, index) => item.id !== tabBarState.tabs[index]?.id);
		if (hasOrderChanged) tabBarState.updatePersistedTabs(newItems);
	}
	function handleDndFinalize(e: CustomEvent<TabDndEvent>) {
		isDndFinalizing = true;

		try {
			draggedElementId = null;
			tabBarState.updatePersistedTabs(e.detail.items);
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

	onMount(async () => {
		isMac = (await deviceService.getPlatform()) === "darwin";
	});

	onDestroy(() => {
		buttonSpring.target = { opacity: 1, x: 0 };
		buttonBounceSpring.target = { x: 0 };

		window.cancelAnimationFrame?.(0);
	});
</script>

<div
	class={cn(
		"h-[calc(env(titlebar-area-height,40px)+1px)] bg-tabbar-bg flex items-center border-b",
		className,
	)}
	role="tablist"
	style="app-region: drag;"
	aria-label={m.label_button_new_tab() ?? "Tab bar"}
>
	<div
		class={cn(
			"gap-tab-gap px-tabbar-x flex min-w-0 items-center overflow-x-hidden w-[calc(env(titlebar-area-width,100%)-10px)]",
			isMac && "pl-[80px]",
		)}
		use:dndzone={{
			items: tabBarState.tabs,
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
		{#each tabBarState.tabs as tab, index (tab.id)}
			{@const isCurrentActive = tab.active}
			{@const nextTab = tabBarState.tabs[index + 1]}
			{@const isNextActive = nextTab?.active}
			{@const isLastTab = index === tabBarState.tabs.length - 1}
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
					{closable}
					onTabClick={() => tabBarState.handleTabClick(tab)}
					onTabClose={() => tabBarState.handleTabClose(tab)}
					onTabCloseAll={() => tabBarState.handleTabCloseAll()}
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
				class={cn(
					"mx-0.5 !h-[20px] !w-0.5",
					tabBarState.tabs.length === 0 ? "opacity-0" : "opacity-100",
				)}
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
