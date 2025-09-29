<script lang="ts" module>
	import type { Snippet } from "svelte";

	interface TriggerProps {
		onclick: () => void;
	}

	export interface ModelSelectProps {
		trigger?: Snippet<[TriggerProps]>;
		selectedModel: Model | null;
		onModelSelect: (model: Model) => void;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Command from "$lib/components/ui/command";
	import * as ScrollArea from "$lib/components/ui/scroll-area";
	import { m } from "$lib/paraglide/messages";
	import { persistedModelState, persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { cn } from "$lib/utils";
	import { Check, ChevronRight } from "@lucide/svelte";
	import type { Model, Model as ProviderModel } from "@shared/types";

	const { trigger, selectedModel, onModelSelect }: ModelSelectProps = $props();
	let isOpen = $state(false);
	let searchValue = $state("");
	const collapsedProviders = $state<Record<string, boolean>>({});
	let hoveredItemId = $state<string | null>(null);
	let listRef = $state<HTMLElement | null>(null);
	let scrollTop = $state(0);

	const triggerProps: TriggerProps = {
		onclick: () => (isOpen = true),
	};

	// Transform provider-state data to UI format
	const transformedModels = $derived.by(() => {
		const providers = persistedProviderState.current;
		const models = persistedModelState.current;

		return models
			.filter((model) => model.enabled) // Only show enabled models
			.map((model): Model | null => {
				const provider = providers.find((p) => p.id === model.providerId);
				if (!provider) return null;

				return {
					id: model.id,
					name: model.name,
					type: mapModelType(model.type),
					providerId: provider.id,
					capabilities: model.capabilities,
					custom: model.custom,
					enabled: model.enabled,
					collected: model.collected,
					remark: model.remark,
				};
			})
			.filter((model): model is Model => model !== null);
	});

	// Map provider-state model types to chat types
	function mapModelType(type: ProviderModel["type"]): Model["type"] {
		switch (type) {
			case "language":
				return "language";
			case "tts":
				return "tts";
			case "embedding":
				return "embedding";
			case "rerank":
				return "rerank";
			case "image-generation":
				return "image-generation";
			default:
				return "language";
		}
	}

	const groupedModels = $derived(() => {
		const providers = persistedProviderState.current;
		const groups: Record<string, Model[]> = {};

		transformedModels.forEach((model) => {
			if (
				searchValue &&
				!model.name.toLowerCase().includes(searchValue.toLowerCase()) &&
				!model.type.toLowerCase().includes(searchValue.toLowerCase())
			)
				return;

			// Find the provider name by providerId
			const provider = providers.find((p) => p.id === model.providerId);
			if (!provider) return;

			if (!groups[provider.name]) {
				groups[provider.name] = [];
			}
			groups[provider.name].push(model);
		});

		Object.keys(groups).forEach((key) => {
			if (groups[key].length === 0) {
				delete groups[key];
			}
		});

		return groups;
	});

	function handleModelSelect(model: Model) {
		onModelSelect(model);
		isOpen = false;
	}

	function toggleProvider(provider: string) {
		if (listRef) {
			scrollTop = listRef.scrollTop;
		}
		collapsedProviders[provider] = !collapsedProviders[provider];
	}

	function handleItemMouseEnter(modelId: string) {
		hoveredItemId = modelId;
	}

	function handleItemMouseLeave() {
		hoveredItemId = null;
	}

	function handleListMouseLeave() {
		hoveredItemId = null;
	}

	$effect(() => {
		if (searchValue) {
			Object.keys(groupedModels()).forEach((provider) => {
				collapsedProviders[provider] = false;
			});
		}
	});

	$effect(() => {
		if (isOpen && selectedModel) {
			Object.entries(groupedModels()).forEach(([provider, models]) => {
				if (
					models.some(
						(model) =>
							model.id === selectedModel.id && model.providerId === selectedModel.providerId,
					)
				) {
					collapsedProviders[provider] = false;
				}
			});
		}
	});

	$effect(() => {
		if (!isOpen) {
			scrollTop = 0;
		}
	});

	$effect(() => {
		if (isOpen && listRef) {
			setTimeout(() => {
				if (!listRef) return;

				if (selectedModel) {
					const selectedItem = listRef.querySelector(
						`[data-model-id="${selectedModel.providerId}-${selectedModel.id}"]`,
					) as HTMLElement;
					if (selectedItem) {
						selectedItem.scrollIntoView({
							behavior: "instant",
							block: "center",
						});
					}
				} else if (scrollTop > 0) {
					listRef.scrollTop = scrollTop;
				}
			}, 10);
		}
	});
</script>

{#if trigger}
	{@render trigger(triggerProps)}
{:else}
	<Button {...triggerProps}>{m.text_button_model_select_trigger()}</Button>
{/if}

<Command.Dialog bind:open={isOpen} class="w-[638px]">
	<div class="[&_[data-slot=command-input-wrapper]]:!h-12">
		<Command.Input bind:value={searchValue} placeholder={m.placeholder_input_search_model()} />
	</div>
	<ScrollArea.Root class="max-h-[424px]">
		<Command.List bind:ref={listRef} onmouseleave={handleListMouseLeave} class="max-h-full">
			{#each Object.entries(groupedModels()) as [provider, models] (provider)}
				<div class="px-2 py-1">
					<button
						class="text-muted-foreground flex w-full items-center justify-between rounded-sm px-2 py-2 text-sm"
						onclick={() => toggleProvider(provider)}
						disabled={searchValue.length > 0}
					>
						{provider}
						{#if !searchValue}
							<ChevronRight
								class={cn(
									"h-4 w-4 transition-transform duration-200",
									collapsedProviders[provider] ? "" : "rotate-90",
								)}
							/>
						{/if}
					</button>
					{#if !collapsedProviders[provider] || searchValue}
						{#each models as model (`${model.providerId}-${model.id}`)}
							<Command.Item
								onSelect={() => handleModelSelect(model)}
								value={model.name}
								data-model-id="{model.providerId}-{model.id}"
								class={cn(
									"my-1 h-12",
									selectedModel?.id === model.id && selectedModel?.providerId === model.providerId
										? "!bg-accent !text-accent-foreground"
										: "",
									(selectedModel?.id !== model.id ||
										selectedModel?.providerId !== model.providerId) &&
										hoveredItemId !== `${model.providerId}-${model.id}`
										? "aria-selected:text-foreground aria-selected:bg-transparent"
										: "",
								)}
								onmouseenter={() => handleItemMouseEnter(`${model.providerId}-${model.id}`)}
								onmouseleave={handleItemMouseLeave}
							>
								<div class="flex w-full flex-row items-center justify-between pl-2">
									<div class="flex flex-row gap-2">
										{model.name}
										<span class="text-muted-foreground text-sm">{model.type}</span>
									</div>
									{#if selectedModel?.id === model.id && selectedModel?.providerId === model.providerId}
										<Check class="h-4 w-4" />
									{/if}
								</div>
							</Command.Item>
						{/each}
					{/if}
				</div>
			{/each}
		</Command.List>
	</ScrollArea.Root>
</Command.Dialog>
