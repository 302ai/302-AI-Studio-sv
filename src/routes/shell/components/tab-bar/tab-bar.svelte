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

	const { onShellWindowFullscreenChange } = window.electronAPI;
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { cn } from "$lib/utils";
	import { animateButtonBounce } from "$lib/utils/animation";
	import { isMac, isWindows } from "$lib/utils/platform";
	import { Plus } from "@lucide/svelte";
	import type { Tab } from "@shared/types";
	import { onDestroy, onMount } from "svelte";
	import { dndzone, TRIGGERS } from "svelte-dnd-action";
	import { flip } from "svelte/animate";
	import { Spring } from "svelte/motion";
	import { scale } from "svelte/transition";
	import TabItem from "./tab-item.svelte";

	let { class: className, autoStretch = false }: Props = $props();

	let draggedElementId = $state<string | null>(null);
	const buttonSpring = new Spring({ opacity: 1, x: 0 }, { stiffness: 0.2, damping: 0.8 });
	const buttonBounceSpring = new Spring({ x: 0 }, { stiffness: 0.4, damping: 0.6 });

	let previousTabsLength = $state(tabBarState.tabs.length);
	let isAnimating = $state(false);
	let isDndFinalizing = $state(false);
	let isMaximized = $state(false);

	const tabsCountDiff = $derived(tabBarState.tabs.length - previousTabsLength);
	const shouldAnimateCloseTab = $derived(tabsCountDiff < 0 && !isAnimating);
	const closable = $derived(previousTabsLength > 1);

	async function handleNewTab() {
		if (isAnimating) return;

		isAnimating = true;
		await tabBarState.handleNewTab(m.title_new_chat());

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

	async function handleDndConsider(e: CustomEvent<TabDndEvent>) {
		const { info, items: newItems } = e.detail;

		if (info.trigger === TRIGGERS.DRAG_STARTED) {
			draggedElementId = info.id;
			buttonSpring.target = { opacity: 0.3, x: 8 };
			const draggedTab = tabBarState.tabs.find((tab) => tab.id === info.id);
			if (draggedTab) {
				await tabBarState.handleActivateTab(draggedTab.id);
			}

			await tabBarState.handleGeneralOverlayChange(true);
		}

		const hasOrderChanged = newItems.some((item, index) => item.id !== tabBarState.tabs[index]?.id);
		if (hasOrderChanged) {
			const orderChangedTabs = newItems.map((t) => {
				return {
					...t,
					active: t.id === info.id,
				};
			});
			tabBarState.updatePersistedTabs(orderChangedTabs);
		}
	}

	async function handleDndFinalize(e: CustomEvent<TabDndEvent>) {
		isDndFinalizing = true;

		try {
			draggedElementId = null;

			const finalTabs = e.detail.items.map((t) => {
				return {
					...t,
					active: e.detail.info.id === t.id,
				};
			});

			tabBarState.updatePersistedTabs(finalTabs);
			buttonSpring.target = { opacity: 1, x: 0 };
		} catch (error) {
			console.error("Error finalizing drag operation:", error);
		} finally {
			queueMicrotask(() => {
				isDndFinalizing = false;
			});
		}
		await tabBarState.handleGeneralOverlayChange(false);
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

	async function handleTabClick(tabId: string) {
		await tabBarState.handleActivateTab(tabId);
	}

	async function handleTabClose(tabId: string) {
		await tabBarState.handleTabClose(tabId);
	}

	async function handleTabCloseOthers(tabId: string) {
		await tabBarState.handleTabCloseOthers(tabId);
	}

	async function handleTabCloseOffside(tabId: string) {
		await tabBarState.handleTabCloseOffside(tabId);
	}

	async function handleTabClearMessages(tabId: string) {
		const targetTab = tabBarState.tabs.find((tab) => tab.id === tabId);

		if (targetTab?.type === "chat" && targetTab.threadId) {
			// Call the main process to clear messages and notify the tab
			const { tabService } = window.electronAPI;
			await tabService.handleClearTabMessages(tabId, targetTab.threadId);
		}
	}

	async function handleTabGenerateTitle(tabId: string) {
		const targetTab = tabBarState.tabs.find((tab) => tab.id === tabId);

		if (targetTab?.type === "chat" && targetTab.threadId) {
			// Call the main process to generate title for the tab
			const { tabService } = window.electronAPI;
			await tabService.handleGenerateTabTitle(tabId, targetTab.threadId);
		}
	}

	onMount(() => {
		const unsub = onShellWindowFullscreenChange(({ isFullScreen }) => {
			isMaximized = isFullScreen;
		});

		return () => {
			unsub();
		};
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
			isMac &&
				"transition-[padding-left] duration-200 ease-in-out" &&
				(isMaximized ? "pl-[10px]" : "pl-[75px]"),
			isWindows && "pr-[130px]",
		)}
		use:dndzone={{
			items: tabBarState.tabs,
			flipDurationMs: 100,
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
			{@const offsideClosable = index !== tabBarState.tabs.length - 1}
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
					{offsideClosable}
					onTabClick={handleTabClick}
					onTabNew={handleNewTab}
					onTabClose={handleTabClose}
					onTabCloseOthers={handleTabCloseOthers}
					onTabCloseOffside={handleTabCloseOffside}
					onTabClearMessages={handleTabClearMessages}
					onTabGenerateTitle={handleTabGenerateTitle}
					onOpenChange={(open) => tabBarState.handleTabOverlayChange(tab.id, open)}
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
			<Button
				title={m.label_button_new_tab()}
				variant="ghost"
				size="icon"
				class="size-tab-new hover:!bg-tab-btn-hover-inactive bg-transparent transition-colors"
				style="app-region: no-drag;"
				onclick={handleNewTab}
			>
				<Plus class="size-tab-icon" />
			</Button>
		</div>
	</div>
</div>
