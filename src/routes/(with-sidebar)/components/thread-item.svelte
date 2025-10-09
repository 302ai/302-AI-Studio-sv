<script lang="ts">
	import ButtonWithTooltip from "$lib/components/buss/button-with-tooltip/button-with-tooltip.svelte";
	import * as ContextMenu from "$lib/components/ui/context-menu";
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
		onToggleFavorite: (threadId: string) => void;
		onRenameThread: (threadId: string, currentName: string) => void;
		onThreadDelete: (threadId: string) => void;
	}

	let {
		threadId,
		thread,
		isActive,
		isFavorite,
		onThreadClick,
		onToggleFavorite,
		onRenameThread,
		onThreadDelete,
	}: Props = $props();

	let isHovered = $state(false);
	let shouldShowStar = $derived(isFavorite || isHovered);

	function handleClick(threadId: string) {
		if (isActive) return;
		onThreadClick(threadId);
	}

	function handleToggleFavorite(threadId: string, e: Event) {
		e.stopPropagation();
		onToggleFavorite(threadId);
	}
</script>

<ContextMenu.Root>
	<ContextMenu.Trigger
		class={cn(
			"w-full text-left h-10 relative flex items-center pl-4 pr-2 rounded-[10px]",
			isActive ? "bg-accent" : "hover:bg-secondary",
		)}
		onclick={() => handleClick(threadId)}
		onkeydown={(e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				handleClick(threadId);
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
			onclick={(e) => handleToggleFavorite(threadId, e)}
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
	</ContextMenu.Trigger>

	<ContextMenu.Content>
		<ContextMenu.Item onSelect={() => onRenameThread(threadId, thread.title)}>
			{m.title_button_rename()}
		</ContextMenu.Item>

		<ContextMenu.Item onSelect={(e) => handleToggleFavorite(threadId, e)}>
			{isFavorite ? m.title_button_unstar() : m.title_button_star()}
		</ContextMenu.Item>

		<ContextMenu.Separator />

		<ContextMenu.Item onSelect={() => onThreadDelete(threadId)}>
			{m.title_button_delete()}
		</ContextMenu.Item>
	</ContextMenu.Content>
</ContextMenu.Root>
