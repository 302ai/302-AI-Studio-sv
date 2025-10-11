<script lang="ts">
	import { buttonVariants } from "$lib/components/ui/button";
	import * as Item from "$lib/components/ui/item";
	import Label from "$lib/components/ui/label/label.svelte";
	import * as Sheet from "$lib/components/ui/sheet";
	import { m } from "$lib/paraglide/messages";
	import { aiApplicationsState } from "$lib/stores/ai-applications-state.svelte";
	import { LayoutGrid } from "@lucide/svelte";
	import { fly } from "svelte/transition";
	import AiApplicationIcon from "./ai-application-icon.svelte";

	function getRandomItems<T>(array: T[], count: number): T[] {
		const shuffled = [...array].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, Math.min(count, array.length));
	}

	const isReady = $derived(aiApplicationsState.isHydrated);
	let randomApps = $derived(getRandomItems(aiApplicationsState.aiApplications, 4));
</script>

{#if isReady}
	<div transition:fly={{ y: 20, duration: 1000 }} class="flex flex-col max-w-[720px] gap-y-3">
		<Label class="font-light">{m.label_ai_applications()}</Label>

		<div class="flex flex-row flex-wrap items-center gap-x-3.5 gap-y-4">
			{#each randomApps as aiApplication (aiApplication.id)}
				<Item.Root variant="outline" class="h-[46px] py-0 cursor-pointer hover:bg-secondary/80">
					<Item.Media>
						<AiApplicationIcon class="h-7 w-7" toolId={aiApplication.toolId} />
					</Item.Media>
					<Item.Content>
						{aiApplication.name}
					</Item.Content>
				</Item.Root>
			{/each}
			<Sheet.Root>
				<Sheet.Trigger
					class={buttonVariants({
						variant: "outline",
						className:
							"h-[46px] cursor-pointer hover:bg-secondary/80 dark:hover:bg-secondary/80 !border-border",
					})}
				>
					<LayoutGrid className="h-5 w-5" />
					{m.title_button_more_ai_applications()}
				</Sheet.Trigger>
				<Sheet.Content class="border-none !max-w-[260px]">
					<Sheet.Header>
						<Sheet.Title>Sheet Title</Sheet.Title>
						<Sheet.Description>Sheet Description</Sheet.Description>
					</Sheet.Header>
				</Sheet.Content>
			</Sheet.Root>
		</div>
	</div>
{/if}
