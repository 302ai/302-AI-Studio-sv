<script lang="ts">
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
	let messageHeights = $state<number[]>([]);

	// Calculate the scale factor for minimap
	const MINIMAP_WIDTH = 60;
	const MESSAGE_GAP = 2; // Gap between message previews in minimap
	const PADDING_Y = 16; // py-4 = 16px top + 16px bottom

	// Calculate dynamic scale factor to fit all messages in minimap
	const getScaleFactor = (): number => {
		if (!minimapRef || messageHeights.length === 0) return 0.08;

		const minimapHeight = minimapRef.offsetHeight;
		const availableHeight = minimapHeight - PADDING_Y * 2;
		const totalActualHeight = messageHeights.reduce((sum, h) => sum + h, 0);
		const totalGaps = Math.max(0, (messageHeights.length - 1) * MESSAGE_GAP);

		if (totalActualHeight === 0) return 0.08;

		// Calculate scale to fit content within available height
		// The scale should ensure: totalActualHeight * scale + totalGaps = availableHeight
		const scale = (availableHeight - totalGaps) / totalActualHeight;

		// Use a maximum scale to prevent messages from being too large
		return Math.min(scale, 0.1);
	};

	// Get actual message heights from DOM
	const updateMessageHeights = () => {
		if (!scrollContainer) return;

		const messageElements = scrollContainer.querySelectorAll("[data-message-id]");
		const heights: number[] = [];

		// Create a map of message IDs to heights
		const heightMap = new Map<string, number>();
		messageElements.forEach((el) => {
			const id = el.getAttribute("data-message-id");
			if (id) {
				heightMap.set(id, (el as HTMLElement).offsetHeight);
			}
		});

		// Match heights to messages in order
		messages.forEach((message) => {
			const height = heightMap.get(message.id) || 100; // Fallback to 100px
			heights.push(height);
		});

		messageHeights = heights;
	};

	const updateIndicator = () => {
		if (!viewport || !scrollContainer || !minimapRef) return;

		const viewportHeight = viewport.offsetHeight;
		const scrollHeight = viewport.scrollHeight;
		const scrollTop = viewport.scrollTop;
		const minimapHeight = minimapRef.offsetHeight;
		const availableHeight = minimapHeight - PADDING_Y * 2;

		// Safety check: avoid division by zero
		if (scrollHeight === 0 || messageHeights.length === 0) return;

		// Calculate the scale factor used for message previews
		const scaleFactor = getScaleFactor();

		// Calculate cumulative positions in minimap (matching message preview rendering)
		let cumulativeMinimapHeight = 0;
		const minimapPositions: number[] = [];
		for (let i = 0; i < messageHeights.length; i++) {
			minimapPositions.push(cumulativeMinimapHeight);
			const scaledHeight = messageHeights[i] * scaleFactor;
			cumulativeMinimapHeight += scaledHeight + MESSAGE_GAP;
		}
		const totalMinimapContentHeight = cumulativeMinimapHeight - MESSAGE_GAP; // Remove last gap

		// Calculate cumulative positions in actual content
		// Get actual positions from DOM to account for spacing and padding
		const messageElements = Array.from(
			scrollContainer.querySelectorAll("[data-message-id]"),
		) as HTMLElement[];

		if (messageElements.length === 0) return;

		// Get the first message's offsetTop relative to viewport (accounts for pt-12)
		const firstMessageTop = messageElements[0].offsetTop - scrollContainer.offsetTop;
		const actualPositions: number[] = [];
		for (let i = 0; i < messageElements.length; i++) {
			const element = messageElements[i];
			const position = element.offsetTop - scrollContainer.offsetTop - firstMessageTop;
			actualPositions.push(position);
		}
		const totalActualContentHeight =
			actualPositions[actualPositions.length - 1] + messageHeights[messageHeights.length - 1];

		// Map scrollTop to minimap position
		// Find which message the scrollTop corresponds to
		let targetMinimapTop = 0;

		if (scrollTop <= 0) {
			targetMinimapTop = 0;
		} else if (scrollTop >= totalActualContentHeight) {
			targetMinimapTop = totalMinimapContentHeight;
		} else {
			// Find the message segment that contains scrollTop
			for (let i = 0; i < actualPositions.length; i++) {
				const messageStart = actualPositions[i];
				const messageEnd =
					i < actualPositions.length - 1 ? actualPositions[i + 1] : totalActualContentHeight;

				if (scrollTop >= messageStart && scrollTop <= messageEnd) {
					// Interpolate within this message
					const messageProgress = (scrollTop - messageStart) / (messageEnd - messageStart);
					const minimapStart = minimapPositions[i];
					const minimapEnd =
						i < minimapPositions.length - 1 ? minimapPositions[i + 1] : totalMinimapContentHeight;
					targetMinimapTop = minimapStart + (minimapEnd - minimapStart) * messageProgress;
					break;
				}
			}
		}

		// Calculate indicator height (viewport height in minimap scale)
		const viewportHeightInMinimap =
			(viewportHeight / totalActualContentHeight) * totalMinimapContentHeight;
		indicatorHeight = Math.max(viewportHeightInMinimap, 20);
		indicatorTop = PADDING_Y + targetMinimapTop;

		// Boundary limits
		const maxTop = minimapHeight - PADDING_Y - indicatorHeight;
		if (indicatorTop > maxTop) {
			indicatorTop = maxTop;
		}
		if (indicatorTop < PADDING_Y) {
			indicatorTop = PADDING_Y;
		}
	};

	const handleMinimapClick = (event: MouseEvent) => {
		if (!viewport || !minimapRef || !scrollContainer || messageHeights.length === 0) return;

		const rect = minimapRef.getBoundingClientRect();
		const clickY = event.clientY - rect.top;
		const relativeY = Math.max(0, clickY - PADDING_Y);

		// Calculate scale factor and minimap positions (same as updateIndicator)
		const scaleFactor = getScaleFactor();
		let cumulativeMinimapHeight = 0;
		const minimapPositions: number[] = [];
		for (let i = 0; i < messageHeights.length; i++) {
			minimapPositions.push(cumulativeMinimapHeight);
			const scaledHeight = messageHeights[i] * scaleFactor;
			cumulativeMinimapHeight += scaledHeight + MESSAGE_GAP;
		}
		const totalMinimapContentHeight = cumulativeMinimapHeight - MESSAGE_GAP;

		// Get actual positions from DOM
		const messageElements = Array.from(
			scrollContainer.querySelectorAll("[data-message-id]"),
		) as HTMLElement[];
		if (messageElements.length === 0) return;

		const firstMessageTop = messageElements[0].offsetTop - scrollContainer.offsetTop;
		const actualPositions: number[] = [];
		for (let i = 0; i < messageElements.length; i++) {
			const position = messageElements[i].offsetTop - scrollContainer.offsetTop - firstMessageTop;
			actualPositions.push(position);
		}
		const totalActualContentHeight =
			actualPositions[actualPositions.length - 1] + messageHeights[messageHeights.length - 1];

		// Map click position in minimap to actual scroll position
		let targetScrollTop = 0;

		if (relativeY <= 0) {
			targetScrollTop = 0;
		} else if (relativeY >= totalMinimapContentHeight) {
			targetScrollTop = totalActualContentHeight;
		} else {
			// Find which message segment contains the click
			for (let i = 0; i < minimapPositions.length; i++) {
				const minimapStart = minimapPositions[i];
				const minimapEnd =
					i < minimapPositions.length - 1 ? minimapPositions[i + 1] : totalMinimapContentHeight;

				if (relativeY >= minimapStart && relativeY <= minimapEnd) {
					// Interpolate within this message
					const minimapProgress = (relativeY - minimapStart) / (minimapEnd - minimapStart);
					const actualStart = actualPositions[i];
					const actualEnd =
						i < actualPositions.length - 1 ? actualPositions[i + 1] : totalActualContentHeight;
					targetScrollTop = actualStart + (actualEnd - actualStart) * minimapProgress;
					break;
				}
			}
		}

		// Scroll to target position (centered on click)
		viewport.scrollTo({
			top: targetScrollTop - viewport.offsetHeight / 2,
			behavior: "smooth",
		});
	};

	const handleDragStart = (event: MouseEvent) => {
		event.preventDefault();
		isDragging = true;
	};

	const handleDragMove = (event: MouseEvent) => {
		if (!isDragging || !viewport || !minimapRef || !scrollContainer || messageHeights.length === 0)
			return;

		const rect = minimapRef.getBoundingClientRect();
		const dragY = event.clientY - rect.top;
		const relativeY = Math.max(0, dragY - PADDING_Y);

		// Calculate scale factor and minimap positions (same as updateIndicator)
		const scaleFactor = getScaleFactor();
		let cumulativeMinimapHeight = 0;
		const minimapPositions: number[] = [];
		for (let i = 0; i < messageHeights.length; i++) {
			minimapPositions.push(cumulativeMinimapHeight);
			const scaledHeight = messageHeights[i] * scaleFactor;
			cumulativeMinimapHeight += scaledHeight + MESSAGE_GAP;
		}
		const totalMinimapContentHeight = cumulativeMinimapHeight - MESSAGE_GAP;

		// Get actual positions from DOM
		const messageElements = Array.from(
			scrollContainer.querySelectorAll("[data-message-id]"),
		) as HTMLElement[];
		if (messageElements.length === 0) return;

		const firstMessageTop = messageElements[0].offsetTop - scrollContainer.offsetTop;
		const actualPositions: number[] = [];
		for (let i = 0; i < messageElements.length; i++) {
			const position = messageElements[i].offsetTop - scrollContainer.offsetTop - firstMessageTop;
			actualPositions.push(position);
		}
		const totalActualContentHeight =
			actualPositions[actualPositions.length - 1] + messageHeights[messageHeights.length - 1];

		// Map drag position in minimap to actual scroll position
		let targetScrollTop = 0;

		if (relativeY <= 0) {
			targetScrollTop = 0;
		} else if (relativeY >= totalMinimapContentHeight) {
			targetScrollTop = totalActualContentHeight;
		} else {
			// Find which message segment contains the drag position
			for (let i = 0; i < minimapPositions.length; i++) {
				const minimapStart = minimapPositions[i];
				const minimapEnd =
					i < minimapPositions.length - 1 ? minimapPositions[i + 1] : totalMinimapContentHeight;

				if (relativeY >= minimapStart && relativeY <= minimapEnd) {
					// Interpolate within this message
					const minimapProgress = (relativeY - minimapStart) / (minimapEnd - minimapStart);
					const actualStart = actualPositions[i];
					const actualEnd =
						i < actualPositions.length - 1 ? actualPositions[i + 1] : totalActualContentHeight;
					targetScrollTop = actualStart + (actualEnd - actualStart) * minimapProgress;
					break;
				}
			}
		}

		// Apply scroll with boundary limits
		targetScrollTop = targetScrollTop - viewport.offsetHeight / 2;
		viewport.scrollTop = Math.max(
			0,
			Math.min(viewport.scrollHeight - viewport.offsetHeight, targetScrollTop),
		);
	};

	const handleDragEnd = () => {
		isDragging = false;
	};

	onMount(() => {
		if (!viewport) return;

		const handleScroll = () => {
			updateIndicator();
		};

		const handleResize = () => {
			updateMessageHeights();
			updateIndicator();
		};

		viewport.addEventListener("scroll", handleScroll, { passive: true });
		window.addEventListener("resize", handleResize);

		// Initial update
		updateMessageHeights();
		updateIndicator();

		// Setup drag handlers
		document.addEventListener("mousemove", handleDragMove);
		document.addEventListener("mouseup", handleDragEnd);

		return () => {
			viewport.removeEventListener("scroll", handleScroll);
			window.removeEventListener("resize", handleResize);
			document.removeEventListener("mousemove", handleDragMove);
			document.removeEventListener("mouseup", handleDragEnd);
		};
	});

	// Watch for message changes
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		messages;

		// Use double requestAnimationFrame to ensure DOM is fully updated
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				updateMessageHeights();
				updateIndicator();
			});
		});
	});

	// Watch for minimap ref changes
	$effect(() => {
		if (!minimapRef) return;

		// Update when minimap is mounted or resized
		const resizeObserver = new ResizeObserver(() => {
			updateIndicator();
		});

		resizeObserver.observe(minimapRef);

		// Initial update
		requestAnimationFrame(() => {
			updateIndicator();
		});

		return () => {
			resizeObserver.disconnect();
		};
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={minimapRef}
	class={cn(
		"fixed right-0 z-10 transition-all duration-300 select-none pointer-events-auto",
		isHovered || isDragging ? "opacity-100 w-[60px]" : "opacity-70 w-[50px]",
		className,
	)}
	style="top: 60px; bottom: 180px;"
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
	onclick={handleMinimapClick}
	role="scrollbar"
	aria-label="Chat minimap"
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
			{#each messages as message, index}
				{@const scaleFactor = getScaleFactor()}
				{@const height = messageHeights[index] ? messageHeights[index] * scaleFactor : 6}
				<div
					class={cn(
						"w-full rounded-[2px] transition-all duration-200",
						message.role === "user"
							? "bg-primary/40 dark:bg-primary/30 shadow-sm"
							: "bg-gray-500/30 dark:bg-gray-600/25",
						isHovered && "hover:brightness-110",
					)}
					style="height: {Math.max(height, 3)}px; margin-bottom: {MESSAGE_GAP}px;"
					title={message.role === "user" ? "User Message" : "Assistant Message"}
				></div>
			{/each}
		</div>
	</div>

	<!-- Visible area indicator -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		bind:this={visibleIndicator}
		class={cn(
			"absolute left-0 right-0 transition-all duration-150 cursor-grab rounded-r-md pointer-events-auto",
			isDragging
				? "cursor-grabbing border-2 border-primary bg-primary/25 shadow-lg"
				: "border border-primary/70 bg-primary/15 shadow-md hover:bg-primary/20 hover:border-primary",
		)}
		style="top: {indicatorTop}px; height: {Math.max(indicatorHeight, 20)}px;"
		onmousedown={handleDragStart}
		role="slider"
		aria-label="Scroll position indicator"
		tabindex="0"
	>
		<!-- Drag handle indicator -->
		<div class="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
			<div class="flex flex-col gap-[2px] opacity-50">
				<div class="w-3 h-[1px] bg-current rounded-full"></div>
				<div class="w-3 h-[1px] bg-current rounded-full"></div>
				<div class="w-3 h-[1px] bg-current rounded-full"></div>
			</div>
		</div>
	</div>
</div>

<style>
	:global(body.dragging-minimap) {
		cursor: grabbing !important;
		user-select: none !important;
	}
</style>
