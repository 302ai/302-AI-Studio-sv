<script lang="ts" module>
	import type { DynamicToolUIPart } from "ai";

	interface QuestionOption {
		label: string;
		description: string;
	}

	interface Question {
		header: string;
		question: string;
		multiSelect: boolean;
		options: QuestionOption[];
	}

	interface QuestionsInput {
		questions: Question[];
	}

	export interface AskUserQuestionCardProps {
		part: DynamicToolUIPart;
		messageId: string;
	}
</script>

<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import * as Tabs from "$lib/components/ui/tabs";
	import { m } from "$lib/paraglide/messages.js";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import {
		getAnswerForMessage,
		isAnswersHydrated,
		restoreCustomInputs,
		restoreSelectedOptions,
		restoreShowCustomInput,
		saveAnswerForMessage,
	} from "$lib/stores/code-agent/ask-user-answers-state.svelte";
	import { cn } from "$lib/utils";
	import {
		Ban,
		Check,
		Circle,
		CircleCheck,
		LoaderCircle,
		MessageCircleQuestion,
	} from "@lucide/svelte";
	import { SvelteMap, SvelteSet } from "svelte/reactivity";

	let { part, messageId }: AskUserQuestionCardProps = $props();

	// Extract questions from input
	const questionsInput = $derived(part.input as QuestionsInput | undefined);
	const questions = $derived(questionsInput?.questions ?? []);

	// Track active tab index
	let activeTab = $state("0");

	// Track selected answers per question index
	// Note: Using $state because we reassign entire maps when restoring from storage
	// eslint-disable-next-line svelte/no-unnecessary-state-wrap -- reassignment requires $state
	let answers = $state<SvelteMap<number, SvelteSet<string>>>(new SvelteMap());
	// eslint-disable-next-line svelte/no-unnecessary-state-wrap -- reassignment requires $state
	let customInputs = $state<SvelteMap<number, string>>(new SvelteMap());
	// eslint-disable-next-line svelte/no-unnecessary-state-wrap -- reassignment requires $state
	let showCustomInput = $state<SvelteMap<number, boolean>>(new SvelteMap());
	let hasSubmitted = $state(false); // Track if user has submitted locally
	let hasRestoredFromStorage = $state(false); // Prevent double restoration

	// Restore saved answers from persisted state after hydration
	$effect(() => {
		// Wait for storage to be hydrated and prevent double restoration
		if (!isAnswersHydrated() || hasRestoredFromStorage || hasSubmitted) {
			return;
		}

		const savedAnswer = getAnswerForMessage(messageId);
		if (savedAnswer) {
			answers = restoreSelectedOptions(savedAnswer.selectedOptions);
			customInputs = restoreCustomInputs(savedAnswer.customInputs);
			showCustomInput = restoreShowCustomInput(savedAnswer.showCustomInput);
			hasSubmitted = true;
		}
		hasRestoredFromStorage = true;
	});

	const statusConfig = $derived(() => {
		switch (part.state) {
			case "output-available":
				return {
					icon: CircleCheck,
					color: "text-[#38B865]",
					bgColor: "bg-[#38B865]",
					label: m.tool_call_status_success(),
					animate: false,
				};
			case "output-error":
				return {
					icon: Ban,
					color: "text-[#D82525]",
					bgColor: "bg-[#D82525]",
					label: m.tool_call_status_error(),
					animate: false,
				};
			case "input-available":
				return {
					icon: LoaderCircle,
					color: "text-[#0056FE]",
					bgColor: "bg-[#0056FE]",
					label: m.tool_call_status_executing(),
					animate: true,
				};
			case "input-streaming":
				return {
					icon: Circle,
					color: "text-[#0056FE]",
					bgColor: "bg-[#0056FE]",
					label: m.tool_call_status_preparing(),
					animate: true,
				};
			default:
				return {
					icon: Circle,
					color: "text-muted-foreground",
					bgColor: "bg-muted",
					label: "Unknown",
					animate: false,
				};
		}
	});

	// Only consider answered if user has actually submitted locally
	// Don't rely on part.state because backend may set placeholder output
	const isAnswered = $derived(hasSubmitted);

	// Check if a question has been answered
	function hasAnswer(qIndex: number): boolean {
		const selected = answers.get(qIndex);
		const custom = customInputs.get(qIndex);
		const hasCustomInput = showCustomInput.get(qIndex) && custom?.trim();
		return (selected && selected.size > 0) || !!hasCustomInput;
	}

	function handleOptionSelect(questionIndex: number, optionLabel: string, multiSelect: boolean) {
		let current = answers.get(questionIndex);
		if (!current) {
			current = new SvelteSet<string>();
			answers.set(questionIndex, current);
		}

		if (multiSelect) {
			if (current.has(optionLabel)) {
				current.delete(optionLabel);
			} else {
				current.add(optionLabel);
			}
		} else {
			current.clear();
			current.add(optionLabel);

			// Auto-advance to next tab for single-select questions
			if (questionIndex < questions.length - 1) {
				activeTab = String(questionIndex + 1);
			}
		}

		// Hide custom input if a predefined option is selected (only for single select)
		if (!multiSelect) {
			showCustomInput.set(questionIndex, false);
		}
	}

	function handleOtherClick(questionIndex: number, multiSelect: boolean) {
		if (multiSelect) {
			// Toggle custom input for multi-select
			const current = showCustomInput.get(questionIndex);
			showCustomInput.set(questionIndex, !current);
		} else {
			// For single-select, clear previous selection and enable custom input
			let current = answers.get(questionIndex);
			if (!current) {
				current = new SvelteSet<string>();
				answers.set(questionIndex, current);
			}
			current.clear();
			showCustomInput.set(questionIndex, true);
		}
	}

	function handleSubmit() {
		if (!questionsInput?.questions) return;

		// Build answer string from selections
		const answerParts: string[] = [];

		questionsInput.questions.forEach((q, index) => {
			const selected = answers.get(index);
			const custom = customInputs.get(index);
			const hasCustomInput = showCustomInput.get(index) && custom?.trim();

			if (selected && selected.size > 0) {
				if (hasCustomInput) {
					// Combine selected options with custom input
					answerParts.push(`${q.header}: ${Array.from(selected).join(", ")}, ${custom}`);
				} else {
					answerParts.push(`${q.header}: ${Array.from(selected).join(", ")}`);
				}
			} else if (hasCustomInput) {
				answerParts.push(`${q.header}: ${custom}`);
			}
		});

		if (answerParts.length === 0) return;

		// Mark as submitted to disable options
		hasSubmitted = true;

		// Persist answers to store
		saveAnswerForMessage(messageId, answers, customInputs, showCustomInput);

		// Set as input and send
		const answerText = answerParts.join("\n");
		chatState.inputValue = answerText;
		chatState.sendMessage();
	}

	// Check if submit is enabled - all questions must be answered
	const canSubmit = $derived(() => {
		if (!questionsInput?.questions) return false;

		// All questions must have an answer
		return questionsInput.questions.every((_, index) => hasAnswer(index));
	});

	// Reset all answers
	function handleReset() {
		answers.clear();
		customInputs.clear();
		showCustomInput.clear();
	}

	// Build JSON display for submitted answers
	const submittedAnswersJson = $derived(() => {
		if (!questionsInput?.questions) return null;

		const result: Record<string, string[] | string | null> = {};

		questionsInput.questions.forEach((q, index) => {
			const selected = answers.get(index);
			const custom = customInputs.get(index);
			const hasCustomInputValue = showCustomInput.get(index) && custom?.trim();

			// Convert header to camelCase-like key (lowercase first letter, remove spaces)
			const key = q.header.toLowerCase().replace(/\s+/g, "_");

			if (selected && selected.size > 0) {
				const selectedArray = Array.from(selected);
				if (hasCustomInputValue) {
					// Combine selected options with custom input
					result[key] = [...selectedArray, custom!.trim()];
				} else if (q.multiSelect) {
					result[key] = selectedArray;
				} else {
					// Single select: use string directly
					result[key] = selectedArray[0];
				}
			} else if (hasCustomInputValue) {
				result[key] = custom!.trim();
			} else {
				result[key] = null;
			}
		});

		return result;
	});
</script>

<div class="mb-3 rounded-[10px] bg-white px-3.5 py-3 dark:bg-[#1A1A1A]">
	<!-- Header -->
	<div class="flex w-full items-center justify-between gap-x-4 mb-3">
		<!-- Left: Tool Icon and Name -->
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
				<MessageCircleQuestion class="h-5 w-5" />
			</div>

			<div class="flex flex-col items-start gap-0.5">
				<h3 class="text-sm font-medium text-foreground">
					{part.toolName}
				</h3>
				<p class="text-xs text-muted-foreground">{m.tool_call_label_ask_user()}</p>
			</div>
		</div>

		<!-- Right: Status -->
		<div class="flex items-center gap-2">
			{#if statusConfig().animate}
				<div class="h-2 w-2 animate-pulse rounded-full {statusConfig().bgColor}"></div>
			{:else}
				<div class="h-2 w-2 rounded-full {statusConfig().bgColor}"></div>
			{/if}
			<span class="text-sm {statusConfig().color}">{statusConfig().label}</span>
		</div>
	</div>

	<!-- Questions with Tabs -->
	<!-- Questions with Tabs -->
	{#if questions.length > 0}
		<div class="border-t border-border pt-3">
			<Tabs.Root bind:value={activeTab} class="w-full">
				<!-- Tab Headers -->
				{#if questions.length > 1}
					<Tabs.List class="w-full justify-start mb-4 bg-muted/50 p-1 h-auto flex-wrap">
						{#each questions as question, qIndex (qIndex)}
							{@const answered = hasAnswer(qIndex)}
							<Tabs.Trigger value={String(qIndex)} class="flex-1 min-w-[100px]">
								<span>{question.header}</span>
								{#if answered}
									<Check class="ml-2 h-3.5 w-3.5" />
								{/if}
							</Tabs.Trigger>
						{/each}
					</Tabs.List>
				{/if}

				<!-- Active Question Content -->
				{#each questions as question, qIndex (qIndex)}
					<Tabs.Content value={String(qIndex)}>
						{@const isOtherActive = showCustomInput.get(qIndex)}
						<div class="space-y-3">
							<!-- Question text -->
							<p class="text-sm font-medium text-foreground">{question.question}</p>

							<!-- Options -->
							<div class="grid gap-2">
								{#each question.options as option (option.label)}
									{@const isSelected = answers.get(qIndex)?.has(option.label)}
									<button
										type="button"
										class={cn(
											"flex items-start gap-3 p-3 rounded-lg border text-left transition-colors",
											isSelected
												? "border-primary bg-primary/5"
												: "border-border hover:bg-muted/50",
											isAnswered && "cursor-not-allowed opacity-60",
										)}
										onclick={() =>
											handleOptionSelect(
												qIndex,
												option.label,
												question.multiSelect,
											)}
										disabled={isAnswered}
									>
										{#if question.multiSelect}
											<!-- Checkbox style -->
											<div
												class={cn(
													"mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center",
													isSelected
														? "border-primary bg-primary"
														: "border-muted-foreground",
												)}
											>
												{#if isSelected}
													<Check
														class="h-3 w-3 text-primary-foreground"
													/>
												{/if}
											</div>
										{:else}
											<!-- Radio style -->
											<div
												class={cn(
													"mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center",
													isSelected
														? "border-primary"
														: "border-muted-foreground",
												)}
											>
												{#if isSelected}
													<div
														class="h-2 w-2 rounded-full bg-primary"
													></div>
												{/if}
											</div>
										{/if}
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-foreground">
												{option.label}
											</p>
											<p class="text-xs text-muted-foreground">
												{option.description}
											</p>
										</div>
									</button>
								{/each}

								<!-- Other option -->
								<button
									type="button"
									class={cn(
										"flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
										isOtherActive
											? "border-primary bg-primary/5"
											: "border-border hover:bg-muted/50",
										isAnswered && "cursor-not-allowed opacity-60",
									)}
									onclick={() => handleOtherClick(qIndex, question.multiSelect)}
									disabled={isAnswered}
								>
									{#if question.multiSelect}
										<div
											class={cn(
												"h-4 w-4 rounded border-2 flex items-center justify-center",
												isOtherActive
													? "border-primary bg-primary"
													: "border-muted-foreground",
											)}
										>
											{#if isOtherActive}
												<Check class="h-3 w-3 text-primary-foreground" />
											{/if}
										</div>
									{:else}
										<div
											class={cn(
												"h-4 w-4 rounded-full border-2 flex items-center justify-center",
												isOtherActive
													? "border-primary"
													: "border-muted-foreground",
											)}
										>
											{#if isOtherActive}
												<div class="h-2 w-2 rounded-full bg-primary"></div>
											{/if}
										</div>
									{/if}
									<span class="text-sm text-foreground"
										>{m.plan_mode_other_option()}</span
									>
								</button>

								{#if showCustomInput.get(qIndex)}
									<Input
										placeholder={m.plan_mode_enter_custom()}
										value={customInputs.get(qIndex) || ""}
										oninput={(e) => {
											customInputs.set(qIndex, e.currentTarget.value);
										}}
										disabled={isAnswered}
										class="mt-1"
									/>
								{/if}
							</div>
						</div>
					</Tabs.Content>
				{/each}
			</Tabs.Root>
		</div>

		<!-- Action buttons -->
		{#if !isAnswered}
			<div class="mt-4 flex justify-end gap-2 border-t border-border pt-3">
				<Button
					variant="outline"
					onclick={handleReset}
					disabled={chatState.isStreaming || chatState.isSubmitted}
				>
					{m.plan_mode_reset()}
				</Button>
				<Button
					onclick={handleSubmit}
					disabled={!canSubmit() || chatState.isStreaming || chatState.isSubmitted}
				>
					{m.plan_mode_submit()}
				</Button>
			</div>
		{:else}
			<!-- Display submitted answers in JSON format -->
			<div class="mt-4 border-t border-border pt-3">
				<pre
					class="rounded-lg bg-muted/50 p-3 text-xs text-foreground overflow-x-auto font-mono">{JSON.stringify(
						submittedAnswersJson(),
						null,
						2,
					)}</pre>
			</div>
		{/if}
	{/if}

	{#if part.state === "output-error" && part.errorText}
		<div
			class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950"
		>
			<p class="text-xs text-red-900 dark:text-red-100">{part.errorText}</p>
		</div>
	{/if}
</div>
