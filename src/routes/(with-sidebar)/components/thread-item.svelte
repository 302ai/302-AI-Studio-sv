<script lang="ts">
	import ButtonWithTooltip from "$lib/components/buss/button-with-tooltip/button-with-tooltip.svelte";
	import { m } from "$lib/paraglide/messages";
	import { cn } from "$lib/utils";
	import { Star } from "@lucide/svelte";
	import type { ThreadParmas } from "@shared/types";

	interface Props {
		threadId: string;
		thread: ThreadParmas;
		isActive: boolean;
		isFavorite: boolean;
		onThreadClick: (threadId: string) => void;
		onToggleFavorite: (threadId: string, event: Event) => void;
	}

	let { threadId, thread, isActive, isFavorite, onThreadClick, onToggleFavorite }: Props = $props();

	let isHovered = $state(false);
	let shouldShowStar = $derived(isFavorite || isHovered);
</script>

<div
	class={cn(
		"w-full text-left h-10 relative flex items-center p-2 rounded-[10px]",
		isActive ? "bg-accent" : "hover:bg-secondary",
	)}
	role="button"
	tabindex="0"
	onclick={() => onThreadClick(threadId)}
	onkeydown={(e) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onThreadClick(threadId);
		}
	}}
	onmouseenter={() => (isHovered = true)}
	onmouseleave={() => (isHovered = false)}
>
	<span class="text-sm truncate w-full">{thread.title}</span>

	<ButtonWithTooltip
		tooltip={isFavorite ? m.title_button_unstar() : m.title_button_star()}
		variant="ghost"
		size="icon"
		tooltipSide="right"
		class={cn(
			"transition-opacity size-6",
			shouldShowStar ? "opacity-100" : "opacity-0",
			"hover:!bg-transparent",
		)}
		onclick={(e) => {
			e.stopPropagation();
			onToggleFavorite(threadId, e);
		}}
	>
		<Star
			size={16}
			class={cn(
				isFavorite
					? "fill-star-favorite text-star-favorite"
					: isActive
						? "fill-star-unfavorite_active text-star-unfavorite_active"
						: "fill-star-unfavorite_inactive text-star-unfavorite_inactive",
			)}
		/>
	</ButtonWithTooltip>
</div>
