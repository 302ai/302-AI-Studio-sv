<script lang="ts" module>
	import type { Snippet } from "svelte";

	interface TriggerProps {
		onclick: () => void;
	}

	export interface ModelSelectProps {
		trigger?: Snippet<[TriggerProps]>;
		selectedModel: Model | null;
		onModelSelect: (model: Model) => void;
		isVibe: boolean;
	}
</script>

<script lang="ts">
	import { ModelIcon } from "$lib/components/buss/model-icon";
	import { Button } from "$lib/components/ui/button";
	import * as Command from "$lib/components/ui/command";
	import * as ScrollArea from "$lib/components/ui/scroll-area";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent";
	import {
		persistedModelState,
		persistedProviderState,
		providerState,
	} from "$lib/stores/provider-state.svelte";
	import { cn } from "$lib/utils";
	import { getFilteredModels } from "$lib/utils/model-filters.js";
	import { ChevronRight, Star } from "@lucide/svelte";
	import type { Model, ModelCapability, Model as ProviderModel } from "@shared/types";
	import { onMount } from "svelte";
	import { SvelteMap } from "svelte/reactivity";

	const { onShortcutAction } = window.electronAPI.shortcut;

	const { trigger, selectedModel, onModelSelect, isVibe }: ModelSelectProps = $props();

	let isOpen = $state(false);
	let searchValue = $state("");
	let hoveredItemId = $state<string | null>(null);
	let listRef = $state<HTMLElement | null>(null);
	const collapsedProviders = $state<Record<string, boolean>>({});
	let focusedModelIndex = $state(-1);
	let dialogJustOpened = $state(false);

	const triggerProps: TriggerProps = {
		onclick: () => {
			isOpen = true;
		},
	};

	// Transform provider-state data to UI format
	const transformedModels = $derived.by(() => {
		const providers = persistedProviderState.current;
		const models = persistedModelState.current;
		const codeAgentId = codeAgentState.currentAgentId;
		// 使用统一的过滤方法：只显示已启用且（isFeatured === true 或 isAddedByUser === true）的模型
		// judge is Open Claw, Open Claw only supports viewing some models
		const filteredModels = getFilteredModels(
			models,
			true,
			isVibe && codeAgentId == "open-claw",
		);

		return filteredModels
			.map((model): Model | null => {
				const provider = providers.find((p) => p.id === model.providerId);
				if (!provider) return null;

				const modelWithCustom = model as Model & { is_custom_model?: boolean };
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
					isFeatured: model.isFeatured,
					is_custom_model: modelWithCustom.is_custom_model,
				} as Model;
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

				// 分数相同时，优先 featured 模型
				if (a.model.isFeatured !== b.model.isFeatured) {
					return a.model.isFeatured ? -1 : 1;
				}

				// 然后按模型名称长度排序（较短的优先）
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
			// 创建模型到原始索引的映射（用于时间排序）
			const modelToIndex = new SvelteMap<string, number>();
			const allModels = persistedModelState.current;
			allModels.forEach((model, index) => {
				// 使用 providerId 和 id 作为唯一标识
				modelToIndex.set(`${model.providerId}-${model.id}`, index);
			});

			// 无搜索词时，使用原有逻辑
			transformedModels.forEach((model) => {
				const provider = providers.find((p) => p.id === model.providerId);
				if (!provider) return;

				if (!groups[provider.name]) {
					groups[provider.name] = [];
				}
				groups[provider.name].push(model);
			});

			// 对每个分组进行排序（先按名称字母顺序，再按时间排序）
			Object.keys(groups).forEach((key) => {
				if (groups[key].length > 0) {
					groups[key].sort((a, b) => {
						// 先按名称字母顺序排序
						const nameCompare = a.name.localeCompare(b.name);
						if (nameCompare !== 0) {
							return nameCompare;
						}
						// 名称相同时，按添加时间排序（原始数组索引）
						const aIndex = modelToIndex.get(`${a.providerId}-${a.id}`) ?? Infinity;
						const bIndex = modelToIndex.get(`${b.providerId}-${b.id}`) ?? Infinity;
						return aIndex - bIndex;
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
				focusedModelIndex =
					focusedModelIndex < models.length - 1 ? focusedModelIndex + 1 : 0;
				handled = true;
				break;
			case "ArrowUp":
				event.preventDefault();
				event.stopPropagation();
				focusedModelIndex =
					focusedModelIndex > 0 ? focusedModelIndex - 1 : models.length - 1;
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

	function handleInputKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			event.stopPropagation();
			const models = flattenedModels;
			if (focusedModelIndex >= 0 && focusedModelIndex < models.length) {
				handleModelSelect(models[focusedModelIndex]);
			}
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

	// 自动滚动到选中项
	$effect(() => {
		if (isOpen && listRef && selectedModel) {
			// 展开包含选中模型的分组
			Object.entries(groupedModels()).forEach(([provider, models]) => {
				if (
					models.some(
						(model) =>
							model.id === selectedModel.id &&
							model.providerId === selectedModel.providerId,
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

	// Listen for sendMessage shortcut action (Enter key is captured by Electron before-input-event)
	onMount(() => {
		const unsub = onShortcutAction((action) => {
			if (action.action === "sendMessage" && isOpen) {
				const models = flattenedModels;
				if (focusedModelIndex >= 0 && focusedModelIndex < models.length) {
					handleModelSelect(models[focusedModelIndex]);
				}
			}
		});
		return () => unsub();
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

	// Reset focus index when dialog opens/closes
	$effect(() => {
		if (!isOpen) {
			focusedModelIndex = -1;
			dialogJustOpened = false;
		} else if (!dialogJustOpened) {
			// Only initialize when dialog first opens, not on subsequent flattenedModels changes
			dialogJustOpened = true;
			if (selectedModel) {
				const models = flattenedModels;
				const selectedIndex = models.findIndex(
					(m) => m.id === selectedModel.id && m.providerId === selectedModel.providerId,
				);
				focusedModelIndex = selectedIndex >= 0 ? selectedIndex : 0;
			} else {
				// No selected model, focus on first item
				focusedModelIndex = flattenedModels.length > 0 ? 0 : -1;
			}
		}
	});

	$effect(() => {
		// When search value changes, set focus to first result if available
		if (searchValue) {
			// Use untrack to avoid circular dependency
			const models = flattenedModels;
			focusedModelIndex = models.length > 0 ? 0 : -1;
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
		<Command.Input
			bind:value={searchValue}
			placeholder={m.placeholder_input_search_model()}
			onkeydown={handleInputKeyDown}
		/>
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
								selectedModel?.id === model.id &&
								selectedModel?.providerId === model.providerId}
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
									!isSelected &&
										(isHovered || isFocused) &&
										"bg-accent text-accent-foreground",
									!isSelected &&
										!isHovered &&
										!isFocused &&
										"aria-selected:text-foreground aria-selected:bg-transparent",
								)}
								onmouseenter={() =>
									handleItemMouseEnter(`${model.providerId}-${model.id}`)}
								onmouseleave={handleItemMouseLeave}
							>
								<div class="flex w-full items-center gap-2 pl-2 pr-1">
									<div class="flex min-w-0 flex-1 items-center gap-2">
										<ModelIcon
											modelName={model.name}
											className={cn(
												"size-4 shrink-0",
												isSelected &&
													"text-primary-foreground [&_*]:!text-primary-foreground [&_*]:!fill-primary-foreground",
											)}
										/>
										<span class="truncate">{model.name}</span>
										{#if (model as Model & { is_custom_model?: boolean }).is_custom_model}
											<span
												class={cn(
													"flex-shrink-0 rounded-sm px-1.5 py-0.5 text-xs",
													isSelected
														? "bg-primary-foreground/20 text-primary-foreground/80"
														: "bg-muted text-muted-foreground",
												)}
												title={m.common_custom()}
											>
												{m.common_custom()}
											</span>
										{/if}
									</div>

									<Button
										variant="ghost"
										size="icon"
										class={cn(
											"h-7 w-7 shrink-0 p-0",
											isSelected
												? "hover:bg-primary-foreground/10"
												: "hover:bg-accent/50",
										)}
										onclick={(e) => handleToggleCollected(e, model.id)}
										title={model.collected
											? m.title_button_unstar()
											: m.title_button_star()}
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

								<!-- {#if isSelected}
									<div class="absolute top-1 right-1">
										<Check class="h-3.5 w-3.5" />
									</div>
								{/if} -->
							</Command.Item>
						{/each}
					{/if}
				</div>
			{/each}
		</Command.List>
	</ScrollArea.Root>
</Command.Dialog>
