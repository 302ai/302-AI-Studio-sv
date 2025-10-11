<script lang="ts">
	import { buttonVariants } from "$lib/components/ui/button";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { Input } from "$lib/components/ui/input";
	import Label from "$lib/components/ui/label/label.svelte";
	import * as Sheet from "$lib/components/ui/sheet";
	import { m } from "$lib/paraglide/messages";
	import { aiApplicationsState } from "$lib/stores/ai-applications-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { ChevronDown, LayoutGrid } from "@lucide/svelte";
	import type { AiApplication } from "@shared/types";
	import { toast } from "svelte-sonner";
	import { fly } from "svelte/transition";
	import AiApplicationItem from "./ai-application-item.svelte";

	const { aiApplicationService } = window.electronAPI;

	let searchQuery = $state("");
	let categoryCollapsedState = $state<Record<string, boolean>>({});

	let isReady = $derived(aiApplicationsState.isHydrated);
	let randomApps = $derived(
		aiApplicationsState.collectedAiApplications.length > 0
			? getRandomItems(aiApplicationsState.collectedAiApplications, 4)
			: getRandomItems(aiApplicationsState.aiApplications, 4),
	);
	let isSearching = $derived(searchQuery.trim().length > 0);
	let searchQueryLower = $derived(searchQuery.toLowerCase().trim());

	let filteredAppList = $derived.by(() => {
		if (!isSearching) return aiApplicationsState.aiApplications;

		return aiApplicationsState.aiApplications.filter(
			(app) =>
				app.name.toLowerCase().includes(searchQueryLower) ||
				app.description.toLowerCase().includes(searchQueryLower),
		);
	});
	let groupedAppList = $derived.by(() => {
		if (isSearching) return null;

		const groups: Record<string, AiApplication[]> = {};

		aiApplicationsState.aiApplications.forEach((app) => {
			if (!groups[app.category]) {
				groups[app.category] = [];
			}
			groups[app.category].push(app);
		});

		return groups;
	});

	function getRandomItems<T>(array: T[], count: number): T[] {
		const shuffled = [...array].sort(() => Math.random() - 0.5);
		return shuffled.slice(0, Math.min(count, array.length));
	}

	async function handleAiApplicationClick(aiApplication: AiApplication) {
		const { isOk, url } = await aiApplicationService.getAiApplicationUrl(aiApplication.toolId);
		if (!isOk) {
			toast.error(m.error_get_ai_application_url());
			return;
		}
		await tabBarState.handleNewTab(aiApplication.name, "aiApplications", true, url);
	}

	$effect(() => {
		if (groupedAppList) {
			Object.keys(groupedAppList).forEach((category) => {
				if (categoryCollapsedState[category] === undefined) {
					categoryCollapsedState[category] = true;
				}
			});
		}
	});
</script>

{#if isReady}
	<div transition:fly={{ y: 20, duration: 500 }} class="flex flex-col w-[720px] gap-y-3">
		<Label class="font-light">{m.label_ai_applications()}</Label>

		<div class="flex flex-row flex-wrap items-center gap-x-3.5 gap-y-4">
			{#each randomApps as aiApplication (aiApplication.id)}
				<AiApplicationItem
					{aiApplication}
					type="random"
					onClick={() => handleAiApplicationClick(aiApplication)}
				/>
			{/each}
			<Sheet.Root>
				<Sheet.Trigger
					class={buttonVariants({
						variant: "outline",
						className:
							"h-[46px] hover:bg-secondary/80 dark:hover:bg-secondary/80 !border-border !text-foreground !font-normal",
					})}
				>
					<LayoutGrid className="h-5 w-5" />
					{m.title_button_more_ai_applications()}
				</Sheet.Trigger>
				<Sheet.Content class="border-none !max-w-[260px] bg-input">
					<Sheet.Header class="pb-0">
						<Sheet.Title class="font-light text-sm">{m.label_ai_applications()}</Sheet.Title>
						<Input
							class="!bg-background h-10 rounded-[10px]"
							bind:value={searchQuery}
							placeholder={m.placeholder_input_search()}
						/>
					</Sheet.Header>
					<div class="flex flex-col gap-y-1 px-3 flex-1 overflow-y-auto min-h-0">
						{#if isSearching}
							{#each filteredAppList as aiApplication (aiApplication.id)}
								<AiApplicationItem
									{aiApplication}
									type="sheet"
									onClick={() => handleAiApplicationClick(aiApplication)}
								/>
							{/each}
						{:else if groupedAppList}
							{#each Object.entries(groupedAppList) as [category, apps] (category)}
								{#if apps.length > 0}
									<Collapsible.Root
										bind:open={categoryCollapsedState[category]}
										class="group/collapsible flex flex-col gap-y-1"
									>
										<Collapsible.Trigger
											class="flex items-center text-sm justify-between text-start w-full h-10 rounded-[10px] px-3 hover:bg-secondary/80"
										>
											<span>{category}</span>
											<ChevronDown
												class="size-4 transition-transform duration-200 ease-in-out group-data-[state=open]/collapsible:rotate-180 group-data-[state=closed]/collapsible:rotate-0"
											/>
										</Collapsible.Trigger>
										<Collapsible.Content class="flex flex-col gap-y-1">
											{#each apps as aiApplication (aiApplication.id)}
												<AiApplicationItem
													{aiApplication}
													type="sheet"
													onClick={() => handleAiApplicationClick(aiApplication)}
												/>
											{/each}
										</Collapsible.Content>
									</Collapsible.Root>
								{/if}
							{/each}
						{/if}
					</div>
				</Sheet.Content>
			</Sheet.Root>
		</div>
	</div>
{/if}
