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
	import { ModelIcon } from "$lib/components/buss/model-icon";
	import { Button } from "$lib/components/ui/button";
	import * as Command from "$lib/components/ui/command";
	import * as ScrollArea from "$lib/components/ui/scroll-area";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import {
		persistedModelState,
		persistedProviderState,
		providerState,
	} from "$lib/stores/provider-state.svelte";
	import { cn } from "$lib/utils";
	import { Check, ChevronRight, Star } from "@lucide/svelte";
	import { CLUADE_CODE_MODELS } from "@shared/constants/codeAgentModel";
	import type { Model, ModelCapability, Model as ProviderModel } from "@shared/types";

	const { trigger, selectedModel, onModelSelect }: ModelSelectProps = $props();

	let isOpen = $state(false);
	let searchValue = $state("");
	let hoveredItemId = $state<string | null>(null);
	let listRef = $state<HTMLElement | null>(null);
	const collapsedProviders = $state<Record<string, boolean>>({});
	let focusedModelIndex = $state(-1);

	const triggerProps: TriggerProps = {
		onclick: () => {
			isOpen = true;
		},
	};

	// Transform provider-state data to UI format
	const transformedModels = $derived.by(() => {
		const providers = persistedProviderState.current;
		const models = persistedModelState.current;

		// Filter models based on codeAgentState.enabled
		let filteredModels = models.filter((model) => model.enabled);

		if (codeAgentState.enabled) {
			// When code agent is enabled, only show Claude Code models
			filteredModels = filteredModels.filter((model) => CLUADE_CODE_MODELS.includes(model.id));
		}

		return filteredModels
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

	// 优化搜索和多关键词分词
	function searchAndSortModels(models: Model[], searchTerms: string[]): Model[] {
		if (searchTerms.length === 0) return models;

		return models
			.map((model) => {
				const modelName = model.name.toLowerCase();
				let score = 0;
				const matchDetails = {
					allKeywordsMatch: true,
					startsWithCount: 0,
					exactWordMatches: 0,
					partialMatches: 0,
					exactPhraseMatch: false,
				};

				// 检查是否匹配整个搜索短语（最高优先级）
				const fullSearchPhrase = searchTerms.join(" ").toLowerCase();
				if (modelName.includes(fullSearchPhrase)) {
					score += 50; // 完整短语匹配最高分
					matchDetails.exactPhraseMatch = true;
				}

				// 检查每个搜索词
				for (const term of searchTerms) {
					const lowerTerm = term.toLowerCase();
					let termMatched = false;

					// 1. 精确字首匹配（非常高优先级）
					if (modelName.startsWith(lowerTerm)) {
						score += 20;
						matchDetails.startsWithCount++;
						termMatched = true;
					}
					// 2. 精确单词匹配（在连字符边界处）
					else if (
						modelName.includes(`-${lowerTerm}`) ||
						modelName.includes(`-${lowerTerm}-`) ||
						modelName.includes(` ${lowerTerm}`)
					) {
						score += 15;
						matchDetails.exactWordMatches++;
						termMatched = true;
					}
					// 3. 部分匹配
					else if (modelName.includes(lowerTerm)) {
						score += 2; // 大幅降低部分匹配的分数
						matchDetails.partialMatches++;
						termMatched = true;
					}

					if (!termMatched) {
						matchDetails.allKeywordsMatch = false;
					}
				}

				// 额外加分项 - 只有在匹配了所有关键词时才给予
				if (matchDetails.allKeywordsMatch) {
					score += 30; // 所有关键词匹配的奖励

					// 根据匹配质量额外加分
					if (matchDetails.startsWithCount > 0) {
						score += matchDetails.startsWithCount * 10;
					}
					if (matchDetails.exactWordMatches > 0) {
						score += matchDetails.exactWordMatches * 8;
					}
				}

				return { model, score, matchDetails };
			})
			.filter(({ score, matchDetails }) => {
				// 过滤条件：至少匹配一个搜索词，且分数不能太低
				// 特别地，如果匹配了所有关键词，即使分数较低也要显示
				return score > 5 || matchDetails.allKeywordsMatch;
			})
			.sort((a, b) => {
				// 主要按分数排序
				if (b.score !== a.score) {
					return b.score - a.score;
				}

				// 分数相同的情况下，优先所有关键词匹配的
				if (a.matchDetails.allKeywordsMatch !== b.matchDetails.allKeywordsMatch) {
					return b.matchDetails.allKeywordsMatch ? 1 : -1;
				}

				// 然后优先字首匹配更多的
				if (b.matchDetails.startsWithCount !== a.matchDetails.startsWithCount) {
					return b.matchDetails.startsWithCount - a.matchDetails.startsWithCount;
				}

				// 然后优先精确单词匹配更多的
				if (b.matchDetails.exactWordMatches !== a.matchDetails.exactWordMatches) {
					return b.matchDetails.exactWordMatches - a.matchDetails.exactWordMatches;
				}

				// 最后按模型名称长度排序（较短的优先）
				if (a.model.name.length !== b.model.name.length) {
					return a.model.name.length - b.model.name.length;
				}

				// 最后按字母顺序排序
				return a.model.name.localeCompare(b.model.name);
			})
			.map(({ model }) => model);
	}

	const groupedModels = $derived(() => {
		const providers = persistedProviderState.current;
		const groups: Record<string, Model[]> = {};
		const searchTerms = searchValue
			.trim()
			.split(/\s+/)
			.filter((term) => term.length > 0);

		if (searchTerms.length > 0) {
			// 应用搜索排序
			const sortedModels = searchAndSortModels(transformedModels, searchTerms);

			// 按提供商分组已排序的模型
			sortedModels.forEach((model) => {
				const provider = providers.find((p) => p.id === model.providerId);
				if (!provider) return;

				if (!groups[provider.name]) {
					groups[provider.name] = [];
				}
				groups[provider.name].push(model);
			});
		} else {
			// 无搜索词时，使用原有逻辑
			transformedModels.forEach((model) => {
				const provider = providers.find((p) => p.id === model.providerId);
				if (!provider) return;

				if (!groups[provider.name]) {
					groups[provider.name] = [];
				}
				groups[provider.name].push(model);
			});

			// 对每个分组进行排序（无搜索时按收藏排序）
			Object.keys(groups).forEach((key) => {
				if (groups[key].length > 0) {
					groups[key].sort((a, b) => {
						if (a.collected === b.collected) return 0;
						return a.collected ? -1 : 1;
					});
				}
			});
		}

		// 清理空分组
		Object.keys(groups).forEach((key) => {
			if (groups[key].length === 0) {
				delete groups[key];
			}
		});

		return groups;
	});
	// Flattened list of all visible models for keyboard navigation
	const flattenedModels = $derived.by(() => {
		const models: Model[] = [];
		Object.entries(groupedModels()).forEach(([provider, providerModels]) => {
			// Only include models from expanded providers (or all if searching)
			if (!collapsedProviders[provider] || searchValue) {
				models.push(...providerModels);
			}
		});
		return models;
	});

	function handleModelSelect(model: Model) {
		onModelSelect(model);
		isOpen = false;
	}

	function toggleProvider(provider: string) {
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

	function handleToggleCollected(event: MouseEvent | KeyboardEvent, modelId: string) {
		event.stopPropagation();
		event.preventDefault();
		providerState.toggleModelCollected(modelId);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!isOpen) return;

		const models = flattenedModels;
		if (models.length === 0) return;

		let handled = false;

		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				event.stopPropagation();
				focusedModelIndex = focusedModelIndex < models.length - 1 ? focusedModelIndex + 1 : 0;
				handled = true;
				break;
			case "ArrowUp":
				event.preventDefault();
				event.stopPropagation();
				focusedModelIndex = focusedModelIndex > 0 ? focusedModelIndex - 1 : models.length - 1;
				handled = true;
				break;
			case "Enter":
				if (focusedModelIndex >= 0 && focusedModelIndex < models.length) {
					event.preventDefault();
					event.stopPropagation();
					handleModelSelect(models[focusedModelIndex]);
					handled = true;
				}
				break;
		}

		if (handled && focusedModelIndex >= 0) {
			// Clear hover state when using keyboard
			hoveredItemId = null;
		}
	}

	function getCapabilityText(capability: ModelCapability): string {
		switch (capability) {
			case "reasoning":
				return m.text_capability_reasoning();
			case "vision":
				return m.text_capability_vision();
			case "music":
				return m.text_capability_music();
			case "video":
				return m.text_capability_video();
			case "function_call":
				return m.text_capability_function_call();
			default:
				return "";
		}
	}

	// Auto-switch model when code agent is enabled
	$effect(() => {
		if (codeAgentState.enabled) {
			// Find the claude-sonnet-4-5-20250929 model
			const targetModel = transformedModels.find(
				(model) => model.id === "claude-sonnet-4-5-20250929",
			);

			// If target model exists and is different from current selection, switch to it
			if (
				targetModel &&
				(selectedModel?.id !== targetModel.id ||
					selectedModel?.providerId !== targetModel.providerId)
			) {
				onModelSelect(targetModel);
			}
		}
	});

	// 自动滚动到选中项
	$effect(() => {
		if (isOpen && listRef && selectedModel) {
			// 展开包含选中模型的分组
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

			// 延迟执行滚动，确保 DOM 已渲染
			setTimeout(() => {
				if (!listRef || !selectedModel) return;

				const selectedItem = listRef.querySelector(
					`[data-model-id="${selectedModel.providerId}-${selectedModel.id}"]`,
				) as HTMLElement;

				if (selectedItem) {
					selectedItem.scrollIntoView({ behavior: "instant", block: "center" });
				}
			}, 100);
		}
	});

	// Keyboard event listener
	$effect(() => {
		if (!isOpen) return;

		// Use capture phase to intercept before Command component handles it
		document.addEventListener("keydown", handleKeyDown, true);

		return () => {
			document.removeEventListener("keydown", handleKeyDown, true);
		};
	});

	// Reset focus index when dialog opens/closes or search changes
	$effect(() => {
		if (!isOpen) {
			focusedModelIndex = -1;
		} else if (selectedModel) {
			// When dialog opens, set focus to the currently selected model
			const models = flattenedModels;
			const selectedIndex = models.findIndex(
				(m) => m.id === selectedModel.id && m.providerId === selectedModel.providerId,
			);
			focusedModelIndex = selectedIndex >= 0 ? selectedIndex : -1;
		}
	});

	$effect(() => {
		// Reset focus when search value changes
		if (searchValue) {
			focusedModelIndex = -1;
		}
	});

	// Auto-scroll to focused item when keyboard navigating
	$effect(() => {
		if (focusedModelIndex >= 0 && listRef) {
			const models = flattenedModels;
			if (focusedModelIndex >= models.length) return;

			const focusedModel = models[focusedModelIndex];
			const focusedItem = listRef.querySelector(
				`[data-model-id="${focusedModel.providerId}-${focusedModel.id}"]`,
			) as HTMLElement;

			if (focusedItem) {
				focusedItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}
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
							{@const isSelected =
								selectedModel?.id === model.id && selectedModel?.providerId === model.providerId}
							{@const modelIndex = flattenedModels.findIndex(
								(m) => m.id === model.id && m.providerId === model.providerId,
							)}
							{@const isFocused = focusedModelIndex === modelIndex}
							{@const isHovered = hoveredItemId === `${model.providerId}-${model.id}`}
							{@const capabilityTexts = Array.from(model.capabilities || [])
								.map((cap) => getCapabilityText(cap))
								.filter((text) => text !== "")
								.join("、")}

							<Command.Item
								onSelect={() => handleModelSelect(model)}
								value={model.name}
								data-model-id="{model.providerId}-{model.id}"
								data-focused={isFocused}
								title={capabilityTexts || model.name}
								class={cn(
									"relative my-1 h-12 overflow-hidden",
									isSelected && "!bg-primary !text-primary-foreground",
									!isSelected && (isHovered || isFocused) && "bg-accent text-accent-foreground",
									!isSelected &&
										!isHovered &&
										!isFocused &&
										"aria-selected:text-foreground aria-selected:bg-transparent",
								)}
								onmouseenter={() => handleItemMouseEnter(`${model.providerId}-${model.id}`)}
								onmouseleave={handleItemMouseLeave}
							>
								<div class="flex w-full items-center gap-2 pl-2 pr-1">
									<div class="flex min-w-0 flex-1 items-center gap-2">
										<ModelIcon
											modelName={model.name}
											className={cn("size-4 shrink-0", isSelected && "brightness-0 invert")}
										/>
										<span class="truncate">{model.name}</span>
									</div>

									<Button
										variant="ghost"
										size="icon"
										class={cn(
											"h-7 w-7 shrink-0 p-0",
											isSelected ? "hover:bg-primary-foreground/10" : "hover:bg-accent/50",
										)}
										onclick={(e) => handleToggleCollected(e, model.id)}
										title={model.collected ? m.title_button_unstar() : m.title_button_star()}
									>
										<Star
											class={cn(
												"size-4",
												model.collected
													? "fill-yellow-500 text-yellow-500"
													: isSelected
														? "text-primary-foreground/60 hover:text-primary-foreground"
														: "text-muted-foreground hover:text-foreground",
											)}
										/>
									</Button>
								</div>

								{#if isSelected}
									<div class="absolute top-1 right-1">
										<Check class="h-3.5 w-3.5" />
									</div>
								{/if}
							</Command.Item>
						{/each}
					{/if}
				</div>
			{/each}
		</Command.List>
	</ScrollArea.Root>
</Command.Dialog>
