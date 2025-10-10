<script lang="ts">
	import { buttonVariants } from "$lib/components/ui/button";
	import * as Item from "$lib/components/ui/item";
	import * as Sheet from "$lib/components/ui/sheet";
	import { aiApplicationsState } from "$lib/stores/ai-applications-state.svelte";
	import AiApplicationIcon from "./ai-application-icon.svelte";

	function getRandomItems<T>(array: T[], count: number): T[] {
		const shuffled = [...array].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, Math.min(count, array.length));
	}

	let randomApps = $derived(getRandomItems(aiApplicationsState.aiApplications, 4));
</script>

<div class="flex flex-row flex-wrap items-center gap-x-3.5 gap-y-4">
	{#each randomApps as aiApplication (aiApplication.id)}
		<Item.Root variant="outline" class="h-[44px] py-0 cursor-pointer hover:bg-secondary/80">
			<Item.Media>
				<AiApplicationIcon class="h-7 w-7" toolId={aiApplication.toolId} />
			</Item.Media>
			<Item.Content>
				{aiApplication.name}
			</Item.Content>
		</Item.Root>
	{/each}
	<Sheet.Root>
		<Sheet.Trigger class={buttonVariants({ variant: "outline" })}>More</Sheet.Trigger>
		<Sheet.Content>
			<Sheet.Header>
				<Sheet.Title>Sheet Title</Sheet.Title>
				<Sheet.Description>Sheet Description</Sheet.Description>
			</Sheet.Header>
		</Sheet.Content>
	</Sheet.Root>
</div>
