<script lang="ts" module>
	export type AssistantMessage = ChatMessage & {
		role: "assistant";
	};

	interface Props {
		message: AssistantMessage;
	}
</script>

<script lang="ts">
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader/index.js";
	import { MarkdownRenderer } from "$lib/components/buss/markdown/index.js";
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import {
		Collapsible,
		CollapsibleContent,
		CollapsibleTrigger,
	} from "$lib/components/ui/collapsible";
	import { m } from "$lib/paraglide/messages.js";
	import { getLocale } from "$lib/paraglide/runtime";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { mcpState } from "$lib/stores/mcp-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { persistedThemeState } from "$lib/stores/theme.state.svelte";
	import type { ChatMessage } from "$lib/types/chat";
	import {
		ChevronDown,
		Lightbulb,
		Server,
		ThumbsDown,
		ThumbsUp,
		Volume2,
		VolumeX,
	} from "@lucide/svelte";
	import type { DynamicToolUIPart } from "ai";
	import { onDestroy } from "svelte";
	import { toast } from "svelte-sonner";
	import MessageActions from "./message-actions.svelte";
	import MessageContextMenu from "./message-context-menu.svelte";
	import ToolCallModal from "./tool-call-modal.svelte";
	import { formatTimeAgo, getAssistantMessageContent } from "./utils";

	let { message }: Props = $props();

	// Extract suggestions from message parts
	const suggestions = $derived(() => {
		console.log("[Suggestions] Message parts:", message.parts);
		const suggestionPart = message.parts.find((part) => part.type === "data-suggestions");
		console.log("[Suggestions] Found suggestion part:", suggestionPart);
		if (suggestionPart && "data" in suggestionPart && suggestionPart.data) {
			const data = suggestionPart.data as { suggestions?: string[] };
			console.log("[Suggestions] Extracted suggestions:", data.suggestions);
			return data.suggestions || [];
		}
		return [];
	});

	function getServerIcon(toolName: string): string | null {
		// Extract server ID from toolName (format: serverId__toolName)
		const parts = toolName.split("__");
		if (parts.length >= 2) {
			const serverId = parts[0];
			const server = mcpState.getServer(serverId);
			return server?.icon || null;
		}

		return null;
	}

	function getServerName(toolName: string): string {
		// Extract server ID from toolName (format: serverId__toolName)
		const parts = toolName.split("__");
		if (parts.length >= 2) {
			const serverId = parts[0];
			const server = mcpState.getServer(serverId);
			return server?.name || m.tool_call_label();
		}

		return m.tool_call_label();
	}

	function getDisplayToolName(toolName: string): string {
		// Remove server ID prefix from display name
		const parts = toolName.split("__");
		return parts.length >= 2 ? parts.slice(1).join("__") : toolName;
	}

	let isReasoningExpanded = $state(!preferencesSettings.autoCollapseThink);
	let selectedToolPart = $state<DynamicToolUIPart | null>(null);
	let isToolModalOpen = $state(false);
	let isReading = $state(false);
	let _currentUtterance: SpeechSynthesisUtterance | null = null;
	let speechSynthesisAvailable = $state(false);

	// Check if speech synthesis is available
	$effect(() => {
		if (typeof window !== "undefined" && window.speechSynthesis) {
			// Try to get voices to check availability
			const checkVoices = () => {
				const voices = window.speechSynthesis.getVoices();
				if (voices.length > 0) {
					speechSynthesisAvailable = true;
					console.log("[ReadAloud] Speech synthesis available with", voices.length, "voices");
				}
			};

			checkVoices();
			window.speechSynthesis.onvoiceschanged = checkVoices;
		}
	});

	$effect(() => {
		if (isStreamingReasoning) {
			isReasoningExpanded = true;
		} else if (!isCurrentMessageStreaming) {
			// When streaming ends, restore to the initial state based on settings
			isReasoningExpanded = !preferencesSettings.autoCollapseThink;
		}
	});

	const isCurrentMessageStreaming = $derived(
		chatState.isLastMessageStreaming && chatState.lastAssistantMessage?.id === message.id,
	);

	const isLastAssistantMessage = $derived(chatState.lastAssistantMessage?.id === message.id);

	const hasReasoningContent = $derived(message.parts.some((part) => part.type === "reasoning"));
	const hasTextContent = $derived(message.parts.some((part) => part.type === "text"));
	const isStreamingReasoning = $derived(
		isCurrentMessageStreaming && hasReasoningContent && !hasTextContent,
	);
	const isStreamingText = $derived(
		isCurrentMessageStreaming && (hasTextContent || (!hasReasoningContent && !hasTextContent)),
	);

	async function handleCopyMessage() {
		try {
			await navigator.clipboard.writeText(getAssistantMessageContent(message));
			toast.success(m.toast_copied_success());
		} catch {
			toast.error(m.toast_copied_failed());
		}
	}

	function handleRegenerate() {
		chatState.regenerateMessage(message.id);
	}

	function handleDelete() {
		chatState.deleteMessage(message.id);
	}

	async function handleCreateBranch() {
		try {
			const newThreadId = await chatState.createBranch(message.id);
			if (newThreadId) {
				// Open the new thread in a new tab
				await tabBarState.handleNewTabForExistingThread(newThreadId);
			} else {
				toast.error(m.toast_unknown_error());
			}
		} catch (error) {
			console.error("Failed to create branch:", error);
			toast.error(m.toast_unknown_error());
		}
	}

	function handleFeedback(feedback: "like" | "dislike") {
		// Toggle feedback if clicking the same button
		const currentFeedback = message.metadata?.feedback;
		const newFeedback = currentFeedback === feedback ? null : feedback;
		chatState.updateMessageFeedback(message.id, newFeedback);
	}

	async function handleReadAloud() {
		if (isReading) {
			// Stop current reading
			window.speechSynthesis.cancel();
			isReading = false;
			_currentUtterance = null;
		} else {
			// Check if speech synthesis is available
			if (!window.speechSynthesis) {
				toast.error("当前浏览器不支持语音朗读");
				return;
			}

			// Start reading
			const textContent = getAssistantMessageContent(message);
			if (!textContent.trim()) {
				toast.error("没有可朗读的内容");
				return;
			}

			// Cancel any ongoing speech first
			window.speechSynthesis.cancel();

			// Set language based on content (simple heuristic)
			const hasChinese = /[\u4e00-\u9fa5]/.test(textContent);
			const targetLang = hasChinese ? "zh-CN" : "en-US";

			// Get available voices - wait for them to load if necessary
			let voices = window.speechSynthesis.getVoices();
			console.log("[ReadAloud] Initial voices:", voices.length);

			if (voices.length === 0) {
				// Wait for voices to load
				console.log("[ReadAloud] Waiting for voices to load...");
				voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
					let timeout: NodeJS.Timeout;

					const handler = () => {
						const loadedVoices = window.speechSynthesis.getVoices();
						if (loadedVoices.length > 0) {
							clearTimeout(timeout);
							console.log("[ReadAloud] Voices loaded:", loadedVoices.length, loadedVoices);
							resolve(loadedVoices);
						}
					};

					window.speechSynthesis.onvoiceschanged = handler;

					// Also try to trigger loading
					window.speechSynthesis.getVoices();

					// Timeout after 3 seconds
					timeout = setTimeout(() => {
						console.log("[ReadAloud] Timeout waiting for voices");
						resolve([]);
					}, 3000);
				});
			}

			if (voices.length === 0) {
				toast.error("系统没有可用的语音引擎，请检查系统语音设置");
				return;
			}

			const utterance = new SpeechSynthesisUtterance(textContent);

			// Find a voice for the target language
			let selectedVoice = voices.find((voice) => voice.lang.startsWith(targetLang.split("-")[0]));

			// Fallback to any available voice
			if (!selectedVoice) {
				selectedVoice = voices[0];
				console.log("[ReadAloud] Using fallback voice:", selectedVoice.name, selectedVoice.lang);
			}

			utterance.voice = selectedVoice;
			utterance.lang = selectedVoice.lang;
			utterance.rate = 1.0;
			utterance.pitch = 1.0;
			utterance.volume = 1.0;

			utterance.onstart = () => {
				isReading = true;
				console.log("[ReadAloud] Started reading");
			};

			utterance.onend = () => {
				isReading = false;
				_currentUtterance = null;
				console.log("[ReadAloud] Finished reading");
			};

			utterance.onerror = (event) => {
				console.error("[ReadAloud] Error:", event);
				isReading = false;
				_currentUtterance = null;
				toast.error(`朗读失败: ${event.error}`);
			};

			_currentUtterance = utterance;

			// Start speaking
			window.speechSynthesis.speak(utterance);
			console.log(
				"[ReadAloud] Speech synthesis started with voice:",
				utterance.voice.name,
				utterance.voice.lang,
			);
		}
	}

	// Cleanup on component destroy
	onDestroy(() => {
		if (isReading) {
			window.speechSynthesis.cancel();
		}
	});
</script>

{#snippet messageHeader(model: string)}
	<div class="flex items-center gap-2">
		<ModelIcon className="size-6" modelName={model} />
		<span class="text-xs text-muted-foreground">{model}</span>
	</div>
{/snippet}

{#snippet messageFooter()}
	<div class="flex items-center gap-2">
		{#if !isCurrentMessageStreaming}
			<MessageActions {message} enabledActions={["copy", "regenerate"]} />

			<!-- Read aloud button (only show if speech synthesis is available) -->
			{#if speechSynthesisAvailable}
				<ButtonWithTooltip
					tooltipSide="bottom"
					class="{isReading
						? 'text-blue-600 dark:text-blue-400'
						: 'text-muted-foreground'} hover:!bg-chat-action-hover"
					tooltip={isReading ? m.text_stop_reading() : m.text_read_aloud()}
					onclick={handleReadAloud}
				>
					{#if isReading}
						<VolumeX />
					{:else}
						<Volume2 />
					{/if}
				</ButtonWithTooltip>
			{/if}

			<div class="h-4 w-px bg-border"></div>

			<!-- Feedback buttons -->
			<div class="flex items-center gap-2">
				<ButtonWithTooltip
					tooltipSide="bottom"
					class="{message.metadata?.feedback === 'like'
						? 'text-green-600 dark:text-green-400'
						: 'text-muted-foreground'} hover:!bg-chat-action-hover"
					tooltip={m.text_feedback_like()}
					onclick={() => handleFeedback("like")}
				>
					<ThumbsUp />
				</ButtonWithTooltip>
				<ButtonWithTooltip
					tooltipSide="bottom"
					class="{message.metadata?.feedback === 'dislike'
						? 'text-red-600 dark:text-red-400'
						: 'text-muted-foreground'} hover:!bg-chat-action-hover"
					tooltip={m.text_feedback_dislike()}
					onclick={() => handleFeedback("dislike")}
				>
					<ThumbsDown />
				</ButtonWithTooltip>
			</div>
		{/if}

		<span class="text-xs text-muted-foreground">
			{formatTimeAgo(message.metadata?.createdAt?.toLocaleString() || "", getLocale())}
		</span>
	</div>
{/snippet}

<MessageContextMenu
	onCopy={handleCopyMessage}
	onRegenerate={handleRegenerate}
	onCreateBranch={handleCreateBranch}
	onDelete={handleDelete}
>
	<div class="group flex flex-col gap-1" data-message-id={message.id}>
		{@render messageHeader(message.metadata?.model || "gpt-4o")}

		{#each message.parts as part, partIndex (partIndex)}
			{#if part.type === "text"}
				{#if preferencesSettings.autoDisableMarkdown}
					<div class="whitespace-pre-wrap text-sm leading-relaxed">
						{part.text}
					</div>
				{:else}
					<MarkdownRenderer
						content={part.text}
						messageId={message.id}
						messagePartIndex={partIndex}
						codeTheme={persistedThemeState.current.shouldUseDarkColors
							? "vitesse-dark"
							: "vitesse-light"}
					/>
				{/if}
			{:else if part.type === "reasoning"}
				{#if !preferencesSettings.autoHideReason}
					<Collapsible bind:open={isReasoningExpanded} class="rounded-lg border bg-muted/30 p-3">
						<CollapsibleTrigger
							class="flex w-full items-center justify-between text-left transition-colors hover:bg-muted/20 rounded-md p-2"
						>
							<div class="flex items-center gap-2">
								<Lightbulb class="h-4 w-4 text-muted-foreground" />
								<span class="text-sm font-medium text-muted-foreground">{m.title_thinking()}</span>
							</div>
							<ChevronDown
								class="h-4 w-4 text-muted-foreground transition-transform duration-200 {isReasoningExpanded
									? 'rotate-180'
									: ''}"
							/>
						</CollapsibleTrigger>
						<CollapsibleContent class="space-y-2">
							<div class="pt-3">
								{#if preferencesSettings.autoDisableMarkdown}
									<div class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
										{part.text}
									</div>
								{:else}
									<div class="text-xs text-muted-foreground">
										<MarkdownRenderer
											content={part.text}
											messageId={message.id}
											messagePartIndex={partIndex}
											codeTheme={persistedThemeState.current.shouldUseDarkColors
												? "vitesse-dark"
												: "vitesse-light"}
										/>
									</div>
								{/if}
							</div>

							{#if isStreamingReasoning}
								<div class="flex items-center gap-2 pt-2 animate-in fade-in duration-300">
									<LdrsLoader
										type="dot-pulse"
										size={16}
										speed={1.2}
										color={persistedThemeState.current.shouldUseDarkColors ? "#a1a1aa" : "#71717a"}
									/>
									<span class="text-xs text-muted-foreground italic">
										{m.title_thinking()}...
									</span>
								</div>
							{/if}
						</CollapsibleContent>
					</Collapsible>
				{/if}
			{:else if part.type === "dynamic-tool"}
				<button
					type="button"
					class="my-2 block w-full cursor-pointer rounded-[10px] border-0 bg-white px-3.5 py-3 text-left hover:bg-[#F9F9F9] dark:bg-[#1A1A1A] dark:hover:bg-[#2D2D2D]"
					onclick={() => {
						selectedToolPart = part;
						isToolModalOpen = true;
					}}
				>
					<div class="flex w-full items-center justify-between gap-x-4">
						<!-- Left: Tool Icon and Name -->
						<div class="flex items-center gap-3">
							<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
								{#if getServerIcon(part.toolName)}
									<span class="text-xl">{getServerIcon(part.toolName)}</span>
								{:else}
									<Server class="h-5 w-5 text-muted-foreground" />
								{/if}
							</div>

							<!-- Tool Name -->
							<div class="flex flex-col items-start gap-1">
								<h3 class="text-sm font-medium text-foreground">
									{getDisplayToolName(part.toolName)}
								</h3>
								<p class="text-xs text-muted-foreground">{getServerName(part.toolName)}</p>
							</div>
						</div>

						<!-- Right: Status -->
						<div class="flex items-center gap-2">
							{#if part.state === "input-streaming"}
								<div class="h-2 w-2 animate-pulse rounded-full bg-[#0056FE]"></div>
								<span class="text-sm text-[#0056FE]">{m.tool_call_status_preparing()}</span>
							{:else if part.state === "input-available"}
								<div class="h-2 w-2 animate-pulse rounded-full bg-[#0056FE]"></div>
								<span class="text-sm text-[#0056FE]">{m.tool_call_status_executing()}</span>
							{:else if part.state === "output-available"}
								<div class="h-2 w-2 rounded-full bg-[#38B865]"></div>
								<span class="text-sm text-[#38B865]">{m.tool_call_status_success()}</span>
							{:else if part.state === "output-error"}
								<div class="h-2 w-2 rounded-full bg-[#D82525]"></div>
								<span class="text-sm text-[#D82525]">{m.tool_call_status_error()}</span>
							{/if}
						</div>
					</div>
				</button>
			{/if}
		{/each}

		{#if isStreamingText}
			<div class="flex items-center gap-3 py-3 animate-in fade-in duration-300">
				<div class="flex items-center justify-center">
					<LdrsLoader
						type="dot-pulse"
						size={24}
						speed={1.2}
						color={persistedThemeState.current.shouldUseDarkColors ? "#a1a1aa" : "#71717a"}
					/>
				</div>
				<span class="text-sm text-muted-foreground italic">
					{m.text_chat_responding()}...
				</span>
			</div>
		{/if}

		<!-- Tool Call Modal -->
		{#if selectedToolPart}
			<ToolCallModal
				part={selectedToolPart}
				messageId={message.id}
				bind:open={isToolModalOpen}
				onOpenChange={(open) => {
					isToolModalOpen = open;
					if (!open) {
						selectedToolPart = null;
					}
				}}
			/>
		{/if}

		{@render messageFooter()}

		<!-- Suggestions -->
		{#if suggestions().length > 0 && !isCurrentMessageStreaming && (!preferencesSettings.showOnlyLastSuggestion || isLastAssistantMessage)}
			{console.log("[Suggestions] Rendering suggestions UI:", suggestions())}
			<div class="mt-3 flex flex-wrap gap-2">
				{#each suggestions() as suggestion, index (index)}
					<button
						type="button"
						onclick={() => {
							chatState.inputValue = suggestion;
						}}
						class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
					>
						{suggestion}
					</button>
				{/each}
			</div>
		{:else}
			{console.log(
				"[Suggestions] Not rendering. Count:",
				suggestions().length,
				"Streaming:",
				isCurrentMessageStreaming,
				"ShowOnlyLast:",
				preferencesSettings.showOnlyLastSuggestion,
				"IsLast:",
				isLastAssistantMessage,
			)}
		{/if}
	</div>
</MessageContextMenu>
