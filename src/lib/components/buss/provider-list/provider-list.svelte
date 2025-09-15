<script lang="ts" module>
	import type { ModelProvider } from "$lib/types/provider.js";
	import type { DndEvent } from "svelte-dnd-action";

	interface Props {
		providers: ModelProvider[];
		activeProviderId?: string;
		onProviderClick?: (provider: ModelProvider) => void;
		onReorder?: (providers: ModelProvider[]) => void;
		onConfigure?: (provider: ModelProvider) => void;
		onRemove?: (provider: ModelProvider) => void;
		class?: string;
	}

	const ANIMATION_CONSTANTS = {
		PROVIDER_APPEAR_DELAY: 120,
		BOUNCE_INTENSITY: 20,
		BOUNCE_DURATION: 200,
		SPRING_CONFIG: { stiffness: 0.2, damping: 0.7 },
	} as const;

	type ProviderDndEvent = DndEvent<ModelProvider>;
</script>

<script lang="ts">
	import { cn } from "$lib/utils";
	import { onDestroy } from "svelte";
	import { dndzone, TRIGGERS } from "svelte-dnd-action";
	import { flip } from "svelte/animate";
	import { scale } from "svelte/transition";
	import ProviderItem from "./provider-item.svelte";

	let {
		providers = $bindable<ModelProvider[]>(),
		activeProviderId = $bindable<string>(),
		onProviderClick,
		onReorder,
		onConfigure,
		onRemove,
		class: className,
	}: Props = $props();

	let draggedElementId = $state<string | null>(null);
	let isDndFinalizing = $state(false);

	function handleProviderClick(provider: ModelProvider) {
		activeProviderId = provider.id;
		onProviderClick?.(provider);
	}

	function handleDndConsider(e: CustomEvent<ProviderDndEvent>) {
		const { info, items: newItems } = e.detail;

		if (info.trigger === TRIGGERS.DRAG_STARTED) {
			draggedElementId = info.id;

			const draggedProvider = providers.find((provider) => provider.id === info.id);
			if (draggedProvider) {
				onProviderClick?.(draggedProvider);
			}
		}

		const hasOrderChanged = newItems.some((item, index) => item.id !== providers[index]?.id);
		if (hasOrderChanged) providers = newItems;
	}

	function handleDndFinalize(e: CustomEvent<ProviderDndEvent>) {
		isDndFinalizing = true;

		try {
			draggedElementId = null;
			providers = e.detail.items;

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

			const providerElement = element.querySelector('[role="button"]') as HTMLElement;
			providerElement?.classList.remove("hover:bg-tab-hover");
			providerElement?.classList.add("bg-tab-active", "text-tab-fg-active", "shadow-sm");
			providerElement?.classList.remove("bg-tab-inactive", "text-tab-fg-inactive");
		} catch (error) {
			console.warn("Error transforming dragged element:", error);
		}
	}

	onDestroy(() => {
		window.cancelAnimationFrame?.(0);
	});
</script>

<div class={cn("flex w-full flex-col", className)} role="list" aria-label="Model providers">
	<div
		class="flex h-full w-full flex-col gap-provider-list-gap"
		use:dndzone={{
			items: providers,
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
		{#each providers as provider (provider.id)}
			<div
				class="flex w-full min-w-0 items-center"
				data-id={provider.id}
				role="presentation"
				aria-label={provider.name}
				animate:flip={{ duration: 200 }}
				in:scale={draggedElementId || isDndFinalizing
					? { duration: 0 }
					: { duration: 250, start: 0.8, delay: ANIMATION_CONSTANTS.PROVIDER_APPEAR_DELAY }}
				out:scale={draggedElementId || isDndFinalizing
					? { duration: 0 }
					: { duration: 200, start: 0.8 }}
			>
				<ProviderItem
					{provider}
					isActive={provider.id === activeProviderId}
					onProviderClick={handleProviderClick}
					{onConfigure}
					{onRemove}
				/>
			</div>
		{/each}
	</div>
</div>
