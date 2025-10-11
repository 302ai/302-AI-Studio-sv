<script lang="ts" module>
	import type { AiApplication } from "@shared/types";

	interface Props {
		aiApplication: AiApplication;
		type: "random" | "sheet";
		onClick: () => void;
	}
</script>

<script lang="ts">
	import ButtonWithTooltip from "$lib/components/buss/button-with-tooltip/button-with-tooltip.svelte";
	import * as Item from "$lib/components/ui/item";
	import { m } from "$lib/paraglide/messages";
	import { aiApplicationsState } from "$lib/stores/ai-applications-state.svelte";
	import { cn } from "$lib/utils";
	import { Star } from "@lucide/svelte";
	import AiApplicationIcon from "./ai-application-icon.svelte";

	let { aiApplication, type, onClick }: Props = $props();

	let isHovered = $state(false);
	let shouldShowStar = $derived(aiApplication.collected || isHovered);

	function handleToggleFavorite(e: Event) {
		e.stopPropagation();
		aiApplicationsState.toggleCollected(aiApplication);
	}
</script>

{#if type === "random"}
	<Item.Root
		variant="outline"
		class="h-[46px] py-0 cursor-default hover:bg-secondary/80"
		onclick={onClick}
	>
		<Item.Media>
			<AiApplicationIcon class="h-7 w-7" toolId={aiApplication.toolId} />
		</Item.Media>
		<Item.Content>
			{aiApplication.name}
		</Item.Content>
	</Item.Root>
{:else}
	<Item.Root
		variant="muted"
		class="h-[46px] py-0 hover:bg-secondary/80 bg-background cursor-default"
		onmouseenter={() => (isHovered = true)}
		onmouseleave={() => (isHovered = false)}
		onclick={onClick}
	>
		<Item.Media>
			<AiApplicationIcon class="h-7 w-7" toolId={aiApplication.toolId} />
		</Item.Media>
		<Item.Content class="min-w-0">
			<div class="flex flex-col">
				<span class="truncate text-sm">{aiApplication.name}</span>
				<p class="text-xs text-muted-foreground truncate" title={aiApplication.description}>
					{aiApplication.description}
				</p>
			</div>
		</Item.Content>
		<Item.Actions>
			<ButtonWithTooltip
				tooltip={aiApplication.collected ? m.title_button_unstar() : m.title_button_star()}
				variant="ghost"
				size="icon"
				tooltipSide="bottom"
				class={cn(
					"transition-opacity size-6",
					shouldShowStar ? "opacity-100" : "opacity-0",
					"hover:!bg-transparent",
				)}
				onclick={handleToggleFavorite}
			>
				<Star
					size={16}
					class={cn(
						aiApplication.collected
							? "fill-star-favorite text-star-favorite"
							: "fill-star-unfavorite-inactive text-star-unfavorite-inactive",
					)}
				/>
			</ButtonWithTooltip>
		</Item.Actions>
	</Item.Root>
{/if}
