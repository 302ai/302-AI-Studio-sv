<script lang="ts" module>
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

	const { onShellWindowFullscreenChange, onTabDragGhostHover, onTabDragGhostClear } =
		window.electronAPI;
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { cn } from "$lib/utils";
	import { animateButtonBounce } from "$lib/utils/animation";
	import { isMac } from "$lib/utils/platform";
	import { Plus } from "@lucide/svelte";
	import { onDestroy, onMount } from "svelte";
	import { flip } from "svelte/animate";
	import { Spring } from "svelte/motion";
	import { scale } from "svelte/transition";
	import TabItem from "./tab-item.svelte";

	let { class: className, autoStretch = false }: Props = $props();

	let draggedTabId = $state<string | null>(null);
	let pendingTargetIndex = $state<number | null>(null);
	let droppedInThisWindow = $state<boolean>(false);
	let insertIndicatorX = $state<number | null>(null);

	const buttonSpring = new Spring({ opacity: 1, x: 0 }, { stiffness: 0.2, damping: 0.8 });
	const buttonBounceSpring = new Spring({ x: 0 }, { stiffness: 0.4, damping: 0.6 });

	let previousTabsLength = $state(tabBarState.tabs.length);
	let isAnimating = $state(false);
	let isMaximized = $state(false);
	let groupEl: HTMLElement | null = null;

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

	function calculateInsertIndex(clientX: number): number {
		const tabs = tabBarState.tabs;
		if (tabs.length === 0) return 0;

		const firstTab = document.querySelector("[data-id]") as HTMLElement;
		if (!firstTab) return tabs.length;

		const rect = firstTab.getBoundingClientRect();
		const tabWidth = rect.width;

		const offset = clientX - rect.left;
		const index = Math.floor(offset / tabWidth + 0.5);
		return Math.max(0, Math.min(index, tabs.length));
	}

	function handleDragStart(e: DragEvent) {
		if (!e.dataTransfer) return;

		// Find the draggable element (TabItem's root div)
		const draggableElement = (e.target as HTMLElement).closest("[data-tab-draggable]");
		if (!draggableElement) return;

		// The parent element should be the wrapper div with data-id
		const tabElement = draggableElement.parentElement;
		if (!tabElement) return;

		const tabId = tabElement.getAttribute("data-id");
		if (!tabId) return;

		const tab = tabBarState.tabs.find((t) => t.id === tabId);
		if (!tab) return;

		draggedTabId = tab.id;
		pendingTargetIndex = null;
		droppedInThisWindow = false;
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", tab.id);

		// Start tracking for cross-window detection
		window.electronAPI.ghostWindowService.startTracking().catch((error) => {
			console.error("[TabBar] Failed to start tracking:", error);
		});

		// Activate the dragged tab and elevate shell view
		tabBarState.handleActivateTab(tab.id);
		tabBarState.handleGeneralOverlayChange(true);

		console.log("[TabBar] Drag started for tab", tab.id);
	}

	function handleDragOver(e: DragEvent) {
		// Check if the dragged tab belongs to current window
		if (draggedTabId != null) {
			const currentIndex = tabBarState.tabs.findIndex((t) => t.id === draggedTabId);
			if (currentIndex === -1) {
				// Tab not in current window - don't handle dragover
				// Don't preventDefault to allow cross-window drag to work properly
				return;
			}
		} else {
			return;
		}

		// Only handle dragover if tab belongs to current window
		e.preventDefault();
		if (!e.dataTransfer) return;

		e.dataTransfer.dropEffect = "move";

		// Calculate target index based on pointer position
		const target = e.currentTarget as HTMLElement;
		const tabElements = Array.from(target.querySelectorAll("[data-id]")) as HTMLElement[];

		let targetIndex = tabElements.length;
		for (let i = 0; i < tabElements.length; i++) {
			const el = tabElements[i];
			const rect = el.getBoundingClientRect();
			const midpoint = rect.left + rect.width / 2;

			if (e.clientX < midpoint) {
				targetIndex = i;
				break;
			}
		}

		// Only record the intended target index; do not reorder during drag
		pendingTargetIndex = targetIndex;

		// Calculate and update indicator position
		const firstTab = document.querySelector("[data-id]") as HTMLElement;
		if (firstTab && tabBarState.tabs.length > 0) {
			const rect = firstTab.getBoundingClientRect();
			const tabWidth = rect.width;
			insertIndicatorX = rect.left + targetIndex * tabWidth;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();

		// Validate: Only handle drop if the dragged tab belongs to current window
		if (draggedTabId != null) {
			const currentIndex = tabBarState.tabs.findIndex((t) => t.id === draggedTabId);
			if (currentIndex === -1) {
				// Tab not in current window - this is a cross-window drag, ignore
				console.log("[TabBar] Drop ignored - tab not in current window");
				return;
			}
		} else {
			// No dragged tab ID, ignore
			return;
		}

		console.log("[TabBar] Drop occurred in same window");
		droppedInThisWindow = true;

		// Finalize reorder now that the drag has completed
		// Fallback: compute target index again if we didn't get a prior dragover
		let targetIndex = pendingTargetIndex;
		if (targetIndex == null) {
			const target = e.currentTarget as HTMLElement;
			const tabElements = Array.from(target.querySelectorAll("[data-id]")) as HTMLElement[];
			targetIndex = tabElements.length;
			for (let i = 0; i < tabElements.length; i++) {
				const el = tabElements[i];
				const rect = el.getBoundingClientRect();
				const midpoint = rect.left + rect.width / 2;
				if (e.clientX < midpoint) {
					targetIndex = i;
					break;
				}
			}
		}

		if (targetIndex != null) {
			const currentIndex = tabBarState.tabs.findIndex((t) => t.id === draggedTabId);
			if (currentIndex !== -1 && currentIndex !== targetIndex) {
				const newTabs = [...tabBarState.tabs];
				const [removed] = newTabs.splice(currentIndex, 1);
				const insertAt = targetIndex > currentIndex ? targetIndex - 1 : targetIndex;
				newTabs.splice(insertAt, 0, removed);
				tabBarState.updatePersistedTabs(newTabs);
			}
		}

		// Clear drag state
		draggedTabId = null;
		pendingTargetIndex = null;
		droppedInThisWindow = false;
		insertIndicatorX = null;
	}

	async function handleDragEnd(e: DragEvent) {
		const tabId = draggedTabId;
		const clientX = e.clientX;
		const clientY = e.clientY;

		// If drop event already handled locally, just cleanup state and exit early
		if (droppedInThisWindow) {
			// Stop tracking and lower shell view
			await window.electronAPI.ghostWindowService.stopTracking().catch((error) => {
				console.error("[TabBar] Failed to stop tracking:", error);
			});
			await tabBarState.handleGeneralOverlayChange(false);

			draggedTabId = null;
			pendingTargetIndex = null;
			droppedInThisWindow = false;
			insertIndicatorX = null;
			console.log("[TabBar] Drag ended (handled by same-window drop)");
			return;
		}

		// If pointer is still within our tabbar container, treat as in-window drop
		if (groupEl && tabId) {
			const rect = groupEl.getBoundingClientRect();
			const inside =
				clientX >= rect.left &&
				clientX <= rect.right &&
				clientY >= rect.top &&
				clientY <= rect.bottom;
			if (inside) {
				// Perform final reorder if we computed a target index during drag
				if (pendingTargetIndex != null) {
					const currentIndex = tabBarState.tabs.findIndex((t) => t.id === tabId);
					if (currentIndex !== -1 && currentIndex !== pendingTargetIndex) {
						const newTabs = [...tabBarState.tabs];
						const [removed] = newTabs.splice(currentIndex, 1);
						const insertAt =
							pendingTargetIndex > currentIndex ? pendingTargetIndex - 1 : pendingTargetIndex;
						newTabs.splice(insertAt, 0, removed);
						tabBarState.updatePersistedTabs(newTabs);
					}
				}

				// Stop tracking and lower shell view
				await window.electronAPI.ghostWindowService.stopTracking().catch((error) => {
					console.error("[TabBar] Failed to stop tracking:", error);
				});
				await tabBarState.handleGeneralOverlayChange(false);

				draggedTabId = null;
				pendingTargetIndex = null;
				droppedInThisWindow = false;
				insertIndicatorX = null;
				console.log("[TabBar] Drag ended (treated as same-window drop by bounds)");
				return;
			}
		}

		// Otherwise, treat as potential cross-window action only if no valid drop target
		// IMPORTANT: Call handleDropAtPointer BEFORE stopTracking to preserve insertTarget
		if (e.dataTransfer?.dropEffect === "none" && tabId) {
			console.log("[TabBar] Tab dragged out of window, calling dropAtPointer");

			const result = await window.electronAPI.windowService.handleDropAtPointer(tabId, {
				screenX: e.screenX,
				screenY: e.screenY,
			});

			if (result) {
				if (result.action === "merged") {
					console.log("[TabBar] Tab merged into window", result.targetWindowId);
					// Backend has atomically updated storage
					// Wait for PersistedState sync to update UI
				} else if (result.action === "detached") {
					console.log("[TabBar] Tab detached to new window", result.newWindowId);
					// Backend has atomically updated storage
					// Wait for PersistedState sync to update UI
				}
			}
		}

		// Stop tracking and lower shell view AFTER handling the drop
		await window.electronAPI.ghostWindowService.stopTracking().catch((error) => {
			console.error("[TabBar] Failed to stop tracking:", error);
		});
		await tabBarState.handleGeneralOverlayChange(false);

		draggedTabId = null;
		pendingTargetIndex = null;
		droppedInThisWindow = false;
		insertIndicatorX = null;
		console.log("[TabBar] Drag ended");
	}

	function handleGhostHover(event: { clientX: number; clientY: number; draggedWidth: number }) {
		const { clientX } = event;

		// Calculate insert index
		const newInsertIndex = calculateInsertIndex(clientX);

		// Calculate indicator position using uniform tab width
		const firstTab = document.querySelector("[data-id]") as HTMLElement;
		if (firstTab && tabBarState.tabs.length > 0) {
			const rect = firstTab.getBoundingClientRect();
			const tabWidth = rect.width;
			insertIndicatorX = rect.left + newInsertIndex * tabWidth;
		} else {
			insertIndicatorX = null;
		}

		// Update insert index on backend
		window.electronAPI.ghostWindowService
			.updateInsertIndex({
				windowId: window.windowId,
				insertIndex: newInsertIndex,
			})
			.catch((error) => {
				console.error("[TabBar] Failed to update insert index:", error);
			});
	}

	function handleGhostClear() {
		insertIndicatorX = null;
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

	onMount(() => {
		const unsubFullscreen = onShellWindowFullscreenChange(({ isFullScreen }) => {
			isMaximized = isFullScreen;
		});

		const unsubGhostHover = onTabDragGhostHover(handleGhostHover);
		const unsubGhostClear = onTabDragGhostClear(handleGhostClear);

		return () => {
			unsubFullscreen();
			unsubGhostHover();
			unsubGhostClear();
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
			"gap-tab-gap px-tabbar-x flex min-w-0 items-center overflow-x-hidden w-[calc(env(titlebar-area-width,100%)-10px)] relative",
			isMac &&
				"transition-[padding-left] duration-200 ease-in-out" &&
				(isMaximized ? "pl-[10px]" : "pl-[75px]"),
			!isMac && "pr-[130px]",
		)}
		bind:this={groupEl}
		ondragstart={handleDragStart}
		ondragover={handleDragOver}
		ondrop={handleDrop}
		ondragend={handleDragEnd}
		role="group"
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
				in:scale={draggedTabId
					? { duration: 0 }
					: { duration: 250, start: 0.8, delay: ANIMATION_CONSTANTS.TAB_APPEAR_DELAY }}
				out:scale={draggedTabId ? { duration: 0 } : { duration: 200, start: 0.8 }}
			>
				<TabItem
					{tab}
					isActive={isCurrentActive}
					isDragging={draggedTabId === tab.id}
					stretch={autoStretch}
					{closable}
					{offsideClosable}
					onTabClick={handleTabClick}
					onTabNew={handleNewTab}
					onTabClose={handleTabClose}
					onTabCloseOthers={handleTabCloseOthers}
					onTabCloseOffside={handleTabCloseOffside}
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

		{#if insertIndicatorX !== null}
			<div
				class="pointer-events-none absolute top-0 z-60 h-full w-0.5 bg-blue-500 transition-all duration-75"
				style="left: {insertIndicatorX}px;"
			></div>
		{/if}

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
