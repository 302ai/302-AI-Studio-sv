<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import type { ChatMessage } from "$lib/types/chat";
	import { cn } from "$lib/utils";
	import { onMount } from "svelte";

	interface Props {
		messages: ChatMessage[];
		viewport: HTMLElement | null;
		scrollContainer: HTMLElement | null;
		class?: string;
	}

	let { messages, viewport, scrollContainer, class: className }: Props = $props();

	let minimapRef: HTMLDivElement | null = $state(null);
	let visibleIndicator: HTMLDivElement | null = $state(null);
	let isDragging = $state(false);
	let isHovered = $state(false);
	let indicatorTop = $state(0);
	let indicatorHeight = $state(0);

	// Store message metrics
	let messageMetrics = $state<{ top: number; height: number; role: string; id: string }[]>([]);
	let contentStartTop = $state(0);
	let totalScrollableHeight = $state(0);

	const MESSAGE_GAP = 2; // Gap between message previews in minimap
	const PADDING_Y = 16; // py-4 = 16px top + 16px bottom

	// Calculate dynamic scale factor based on total scrollable height
	const getScaleFactor = (): number => {
		if (!minimapRef || totalScrollableHeight === 0) return 0.08;

		const minimapHeight = minimapRef.offsetHeight;
		const minimapAvailableHeight = minimapHeight - PADDING_Y * 2;

		// Effective content height is the total scrollable area minus the start offset
		// This maps the "scrollable content" to the "minimap area"
		// We subtract contentStartTop because the minimap starts rendering from the first message
		// But wait, if we want to map the WHOLE scroll area, we should map totalScrollableHeight.
		// However, the visual blocks only represent messages.
		// If we map totalScrollableHeight to minimapAvailableHeight, the messages will be scaled down
		// to make room for the padding.

		// Let's try to map the "content universe" to the "minimap universe".
		// Content Universe: [0, totalScrollableHeight] (relative to viewport top + scrollTop)
		// Actually, let's normalize to [0, totalScrollableHeight - contentStartTop] for the "content part"
		// But we want the indicator to travel the full track.

		// Let's use the "Distorted Space" approach.
		// We have N messages.
		// Total Message Height = sum(metrics.height)
		// Total Gap Height (Minimap) = (N-1) * MESSAGE_GAP
		// Head Height (DOM) = contentStartTop
		// Tail Height (DOM) = totalScrollableHeight - (lastMsg.top + lastMsg.height + contentStartTop)

		// We want to find a scale 's' such that:
		// (Head + TotalMsg + Tail) * s + TotalGap(Minimap) = AvailableHeight
		// Note: DOM gaps are implicitly handled because we map through the segments.
		// Wait, if we use segments, we don't need a global linear scale for everything.
		// We need a scale for the "content" parts (Head, Messages, Tail).
		// The "Gap" parts in Minimap are fixed.

		const totalMessageHeight = messageMetrics.reduce((sum, m) => sum + m.height, 0);
		const totalMinimapGaps = Math.max(0, (messageMetrics.length - 1) * MESSAGE_GAP);

		// Calculate tail height
		let tailHeight = 0;
		if (messageMetrics.length > 0) {
			const lastMsg = messageMetrics[messageMetrics.length - 1];
			// totalScrollableHeight is relative to viewport top (if we consider it as scrollHeight)
			// messageMetrics.top is relative to viewport top + scrollTop (absolute doc position) - contentStartTop?
			// No, let's check updateMetrics.

			// In updateMetrics:
			// top = el.getBoundingClientRect().top - viewportRect.top + viewport.scrollTop
			// This is absolute document position.
			// contentStartTop = messageMetrics[0].top

			// So lastMsg.top is absolute.
			tailHeight = Math.max(0, totalScrollableHeight - (lastMsg.top + lastMsg.height));
		}

		// Head height is contentStartTop (absolute top of first message)
		const headHeight = contentStartTop;

		const contentToScale = headHeight + totalMessageHeight + tailHeight;
		const availableForContent = minimapAvailableHeight - totalMinimapGaps;

		if (contentToScale <= 0) return 0.08;

		const scale = availableForContent / contentToScale;

		// Use a maximum scale to prevent messages from being too large
		return Math.min(scale, 0.1);
	};

	// Update all metrics from DOM
	const updateMetrics = () => {
		if (!scrollContainer || !viewport) return;

		const messageElements = Array.from(
			scrollContainer.querySelectorAll("[data-message-id]"),
		) as HTMLElement[];

		if (messageElements.length === 0) {
			messageMetrics = [];
			return;
		}

		const viewportRect = viewport.getBoundingClientRect();
		const scrollTop = viewport.scrollTop;

		// 1. Measure all messages in absolute document coordinates
		const metrics: { top: number; height: number; role: string; id: string }[] = [];

		let currentMetric: { top: number; height: number; role: string; id: string } | null = null;

		// We iterate by index to handle duplicate message IDs correctly.
		// Since Svelte renders the list in order, the Nth message in the array
		// corresponds to the Nth element in the DOM with data-message-id.
		messages.forEach((msg, index) => {
			const el = messageElements[index];
			if (!el) return;

			const rect = el.getBoundingClientRect();
			const top = rect.top - viewportRect.top + scrollTop;
			const height = rect.height;

			if (currentMetric && currentMetric.role === msg.role) {
				// Merge with previous
				// The new height should cover from the start of the current metric to the end of this new element.
				const newBottom = top + height;
				// Update height to include the new element and any gap between them
				currentMetric.height = newBottom - currentMetric.top;
			} else {
				if (currentMetric) metrics.push(currentMetric);
				currentMetric = {
					top,
					height,
					role: msg.role,
					id: msg.id,
				};
			}
		});
		if (currentMetric) metrics.push(currentMetric);

		messageMetrics = metrics;

		// 2. Determine content start (absolute top of first message)
		if (metrics.length > 0) {
			contentStartTop = metrics[0].top;
		} else {
			contentStartTop = 0;
		}

		// 3. Get total scrollable height
		totalScrollableHeight = viewport.scrollHeight;
	};

	// Map a document Y position to a Minimap Y position
	const getMinimapY = (docY: number, scale: number): number => {
		if (messageMetrics.length === 0) return 0;

		// 1. Head Region
		if (docY < contentStartTop) {
			return docY * scale;
		}

		// 2. Message Regions
		let currentMinimapY = contentStartTop * scale;

		for (let i = 0; i < messageMetrics.length; i++) {
			const metric = messageMetrics[i];
			const msgEnd = metric.top + metric.height;

			// If inside this message
			if (docY >= metric.top && docY <= msgEnd) {
				return currentMinimapY + (docY - metric.top) * scale;
			}

			currentMinimapY += metric.height * scale;

			// If not last message, handle gap
			if (i < messageMetrics.length - 1) {
				const nextMetric = messageMetrics[i + 1];
				// Gap region in DOM: [msgEnd, nextMetric.top]
				// Gap region in Minimap: [currentMinimapY, currentMinimapY + MESSAGE_GAP]

				if (docY > msgEnd && docY < nextMetric.top) {
					const gapProgress = (docY - msgEnd) / (nextMetric.top - msgEnd);
					return currentMinimapY + gapProgress * MESSAGE_GAP;
				}

				currentMinimapY += MESSAGE_GAP;
			}
		}

		// 3. Tail Region
		const lastMsg = messageMetrics[messageMetrics.length - 1];
		const lastMsgEnd = lastMsg.top + lastMsg.height;

		if (docY > lastMsgEnd) {
			return currentMinimapY + (docY - lastMsgEnd) * scale;
		}

		return currentMinimapY;
	};

	// Inverse Map: Minimap Y -> Document Y
	const getDocumentY = (minimapY: number, scale: number): number => {
		if (messageMetrics.length === 0) return 0;

		// 1. Head Region
		const headHeightMinimap = contentStartTop * scale;
		if (minimapY < headHeightMinimap) {
			return minimapY / scale;
		}

		let currentMinimapY = headHeightMinimap;

		for (let i = 0; i < messageMetrics.length; i++) {
			const metric = messageMetrics[i];
			const msgHeightMinimap = metric.height * scale;

			// If inside this message
			if (minimapY >= currentMinimapY && minimapY <= currentMinimapY + msgHeightMinimap) {
				return metric.top + (minimapY - currentMinimapY) / scale;
			}

			currentMinimapY += msgHeightMinimap;

			// If not last message, handle gap
			if (i < messageMetrics.length - 1) {
				const nextMetric = messageMetrics[i + 1];
				// Gap region
				if (minimapY > currentMinimapY && minimapY < currentMinimapY + MESSAGE_GAP) {
					const gapProgress = (minimapY - currentMinimapY) / MESSAGE_GAP;
					const domGapSize = nextMetric.top - (metric.top + metric.height);
					return metric.top + metric.height + gapProgress * domGapSize;
				}

				currentMinimapY += MESSAGE_GAP;
			}
		}

		// 3. Tail Region
		return (
			messageMetrics[messageMetrics.length - 1].top +
			messageMetrics[messageMetrics.length - 1].height +
			(minimapY - currentMinimapY) / scale
		);
	};

	const updateIndicator = () => {
		if (!viewport || !minimapRef) return;

		const viewportHeight = viewport.clientHeight;
		const scrollTop = viewport.scrollTop;
		const minimapHeight = minimapRef.offsetHeight;

		if (totalScrollableHeight === 0) return;

		const scale = getScaleFactor();

		// Calculate indicator position
		const topY = getMinimapY(scrollTop, scale);
		// We clamp the bottom scroll position to totalScrollableHeight to avoid overscroll issues
		const bottomScrollPos = Math.min(totalScrollableHeight, scrollTop + viewportHeight);
		const bottomY = getMinimapY(bottomScrollPos, scale);

		indicatorTop = PADDING_Y + topY;
		indicatorHeight = Math.max(bottomY - topY, 10);

		// Boundary limits
		const maxTop = minimapHeight - PADDING_Y - indicatorHeight;
		if (indicatorTop > maxTop) indicatorTop = maxTop;
		if (indicatorTop < PADDING_Y) indicatorTop = PADDING_Y;
	};

	const handleMinimapClick = (event: MouseEvent) => {
		if (!viewport || !minimapRef) return;

		const rect = minimapRef.getBoundingClientRect();
		const clickY = event.clientY - rect.top;
		const relativeY = Math.max(0, clickY - PADDING_Y);

		performScrollFromPosition(relativeY);
	};

	const handleMinimapKeydown = (event: KeyboardEvent) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			if (!viewport) return;
			viewport.scrollTo({
				top: viewport.scrollHeight / 2,
				behavior: "smooth",
			});
		}
	};

	const performScrollFromPosition = (relativeY: number, isDragging = false) => {
		if (!viewport) return;

		const scale = getScaleFactor();

		// Map minimap position back to scroll position
		// The click represents the center of the desired viewport
		const targetDocY = getDocumentY(relativeY, scale);
		const targetScrollTop = targetDocY - viewport.clientHeight / 2;

		viewport.scrollTo({
			top: targetScrollTop,
			behavior: isDragging ? "instant" : "smooth",
		});
	};

	const handleDragStart = (event: MouseEvent) => {
		event.preventDefault();
		isDragging = true;
		document.body.classList.add("dragging-minimap");
	};

	const handleSliderKeydown = (event: KeyboardEvent) => {
		if (!viewport) return;
		const step = 100;
		let handled = false;

		switch (event.key) {
			case "ArrowUp":
			case "ArrowLeft":
				viewport.scrollTop = Math.max(0, viewport.scrollTop - step);
				handled = true;
				break;
			case "ArrowDown":
			case "ArrowRight":
				viewport.scrollTop = Math.min(
					viewport.scrollHeight - viewport.offsetHeight,
					viewport.scrollTop + step,
				);
				handled = true;
				break;
			case "Home":
				viewport.scrollTop = 0;
				handled = true;
				break;
			case "End":
				viewport.scrollTop = viewport.scrollHeight - viewport.offsetHeight;
				handled = true;
				break;
			case "PageUp":
				viewport.scrollTop = Math.max(0, viewport.scrollTop - viewport.offsetHeight);
				handled = true;
				break;
			case "PageDown":
				viewport.scrollTop = Math.min(
					viewport.scrollHeight - viewport.offsetHeight,
					viewport.scrollTop + viewport.offsetHeight,
				);
				handled = true;
				break;
		}

		if (handled) event.preventDefault();
	};

	const getScrollPercentage = (): number => {
		if (!viewport) return 0;
		const max = viewport.scrollHeight - viewport.offsetHeight;
		if (max <= 0) return 0;
		return Math.round((viewport.scrollTop / max) * 100);
	};

	const handleDragMove = (event: MouseEvent) => {
		if (!isDragging || !viewport || !minimapRef) return;

		const rect = minimapRef.getBoundingClientRect();
		const dragY = event.clientY - rect.top;
		const relativeY = Math.max(0, dragY - PADDING_Y);

		performScrollFromPosition(relativeY, true);
	};

	const handleDragEnd = () => {
		isDragging = false;
		document.body.classList.remove("dragging-minimap");
	};

	onMount(() => {
		if (!viewport) return;

		const handleScroll = () => {
			updateIndicator();
		};

		const handleResize = () => {
			updateMetrics();
			updateIndicator();
		};

		viewport.addEventListener("scroll", handleScroll, { passive: true });
		window.addEventListener("resize", handleResize);

		// Initial update
		updateMetrics();
		updateIndicator();

		document.addEventListener("mousemove", handleDragMove);
		document.addEventListener("mouseup", handleDragEnd);

		return () => {
			if (viewport) viewport.removeEventListener("scroll", handleScroll);
			window.removeEventListener("resize", handleResize);
			document.removeEventListener("mousemove", handleDragMove);
			document.removeEventListener("mouseup", handleDragEnd);
			document.body.classList.remove("dragging-minimap");
		};
	});

	// Watch for message changes
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		messages;

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				updateMetrics();
				updateIndicator();
			});
		});
	});

	// Watch for scrollContainer and viewport resize
	$effect(() => {
		const elementsToObserve = [];
		if (scrollContainer) {
			elementsToObserve.push(scrollContainer);
			const messageElements = scrollContainer.querySelectorAll("[data-message-id]");
			messageElements.forEach((el) => elementsToObserve.push(el));
		}
		if (viewport) elementsToObserve.push(viewport);

		if (elementsToObserve.length === 0) return;

		const resizeObserver = new ResizeObserver(() => {
			requestAnimationFrame(() => {
				updateMetrics();
				updateIndicator();
			});
		});

		elementsToObserve.forEach((el) => resizeObserver.observe(el));

		let mutationObserver: MutationObserver | null = null;
		if (scrollContainer) {
			mutationObserver = new MutationObserver((mutations) => {
				let shouldUpdate = false;
				mutations.forEach((mutation) => {
					if (mutation.type === "childList") {
						shouldUpdate = true;
						mutation.addedNodes.forEach((node) => {
							if (
								node instanceof HTMLElement &&
								node.hasAttribute("data-message-id")
							) {
								resizeObserver.observe(node);
							}
						});
					}
				});

				if (shouldUpdate) {
					requestAnimationFrame(() => {
						updateMetrics();
						updateIndicator();
					});
				}
			});
			mutationObserver.observe(scrollContainer, { childList: true, subtree: true });
		}

		return () => {
			resizeObserver.disconnect();
			mutationObserver?.disconnect();
		};
	});

	// Watch for minimap ref changes
	$effect(() => {
		if (!minimapRef) return;

		const resizeObserver = new ResizeObserver(() => {
			updateIndicator();
		});

		resizeObserver.observe(minimapRef);
		requestAnimationFrame(() => updateIndicator());
		return () => resizeObserver.disconnect();
	});
</script>

<div
	bind:this={minimapRef}
	class={cn(
		"absolute right-0 z-10 transition-all duration-300 select-none pointer-events-auto",
		isHovered || isDragging ? "opacity-100" : "opacity-70",
		"w-[28px]",
		className,
	)}
	style="top: 60px; bottom: 180px;"
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
	onclick={handleMinimapClick}
	onkeydown={handleMinimapKeydown}
	role="scrollbar"
	aria-label={m.title_chat_minimap()}
	aria-controls={viewport?.id || "chat-viewport"}
	aria-valuenow={getScrollPercentage()}
	tabindex="0"
>
	<!-- Background with gradient fade -->
	<div
		class="absolute inset-0 bg-gradient-to-l from-gray-100/95 via-gray-100/90 to-transparent dark:from-gray-900/95 dark:via-gray-900/90 dark:to-transparent backdrop-blur-sm"
	>
		<div
			class="absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-transparent via-gray-300 to-transparent dark:via-gray-700 pointer-events-none"
		></div>

		<!-- Message previews container -->
		<div class="relative w-full h-full overflow-hidden px-2 py-4 pointer-events-none">
			{#each messageMetrics as metric, index (metric.id + "-" + index)}
				{@const scaleFactor = getScaleFactor()}
				{@const height = metric.height * scaleFactor}
				<!-- We need to map the top position using getMinimapY logic, but simplified for blocks -->
				<!-- Actually, getMinimapY(metric.top) should give the exact top position in minimap -->
				<!-- But wait, getMinimapY includes Head scaling. -->
				<!-- The container starts at PADDING_Y. -->
				<!-- So style top should be getMinimapY(metric.top) -->

				<div
					class={cn(
						"absolute left-2 right-2 rounded-[2px]",
						metric.role === "user"
							? "bg-primary/40 dark:bg-primary/30 shadow-sm"
							: "bg-gray-500/30 dark:bg-gray-600/25",
						isHovered && "hover:brightness-110",
					)}
					style="height: {Math.max(height, 2)}px; top: {getMinimapY(
						metric.top,
						scaleFactor,
					) + PADDING_Y}px;"
					title={metric.role === "user"
						? m.title_user_message()
						: m.title_assistant_message()}
				></div>
			{/each}
		</div>
	</div>

	<!-- Visible area indicator -->
	<div
		bind:this={visibleIndicator}
		class={cn(
			"absolute left-0 right-0 cursor-grab pointer-events-auto",
			isDragging
				? "cursor-grabbing border-2 border-primary bg-primary/25 shadow-lg"
				: "border border-primary/70 bg-primary/15 shadow-md hover:bg-primary/20 hover:border-primary",
		)}
		style="top: {indicatorTop}px; height: {Math.max(indicatorHeight, 20)}px;"
		onmousedown={handleDragStart}
		onkeydown={handleSliderKeydown}
		role="slider"
		aria-label={m.title_scroll_position_indicator()}
		aria-valuenow={getScrollPercentage()}
		aria-valuemin="0"
		aria-valuemax="100"
		tabindex="0"
	>
		<!-- Drag handle indicator -->
		<div class="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
			<div class="flex flex-col gap-[2px] opacity-50"></div>
		</div>
	</div>
</div>

<style>
	:global(body.dragging-minimap) {
		cursor: grabbing !important;
		user-select: none !important;
	}
</style>
