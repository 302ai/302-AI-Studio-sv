<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import * as Resizable from "$lib/components/ui/resizable/index.js";
	import { m } from "$lib/paraglide/messages.js";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { chat, chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentSendMessageButtonState } from "$lib/stores/code-agent/code-agent-send-message-button-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { htmlPreviewState } from "$lib/stores/html-preview-state.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { generateFilePreview } from "$lib/utils/file-preview";
	import { setupPanelResize } from "$lib/utils/panel-resize";
	import { Eraser, History, MessageSquarePlus } from "@lucide/svelte";
	import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
	import { createLogger } from "@shared/logger";
	import type { AttachmentFile, Model, ThreadParmas } from "@shared/types";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import PageHeader from "../../components/page-header.svelte";
	import AgentPreviewPanel from "../components/agent-preview/agent-preview-panel.svelte";
	import { AiApplicationItems } from "../components/ai-applications";
	import { ChatInputBox } from "../components/chat-input";
	import TaskboardStatusBar from "../components/chat-input/code-agent/taskboard-status-bar.svelte";
	import { FileUploadOverlay } from "../components/file-upload-overlay";
	import { HtmlPreviewPanel } from "../components/html-preview";
	import { MessageList } from "../components/message";

	const logger = createLogger("ui");

	let isInputAreaHovered = $state(false);
	let fileUploadOverlayRef: FileUploadOverlay | null = $state(null);

	const shouldShowTaskboardStatus = $derived(
		codeAgentState.inCodeAgentMode &&
			codeAgentTaskboardState.showTaskboardStatusBar &&
			chatState.hasMessages,
	);

	function handleFilesAdded(attachments: AttachmentFile[]) {
		for (const attachment of attachments) {
			chatState.addAttachment(attachment);
			chatState.setAttachmentLoading(attachment.id, true);

			generateFilePreview(attachment.file).then((preview) => {
				chatState.updateAttachment(attachment.id, { preview });
				chatState.setAttachmentLoading(attachment.id, false);
			});
		}
	}
	onMount(() => {
		// Restore UI state if available (Tab Rehydration)
		const uiState = window.tab?.uiState;
		if (uiState) {
			logger.debug("Restoring UI state:", uiState);
			if (uiState.inputValue) {
				chatState.inputValue = uiState.inputValue;
			}

			if (uiState.scrollPosition) {
				// Wait for message list to render
				setTimeout(() => {
					const viewport = document.querySelector('[data-slot="scroll-area-viewport"]');
					if (viewport) {
						viewport.scrollTop = uiState.scrollPosition ?? 0;
						logger.debug("Restored scroll position:", uiState.scrollPosition);
					}
				}, 100);
			}
		}

		// Listen for snapshot requests (Tab Sleeping)
		const unsubSnapshot = window.electronAPI.onTabRequestSnapshot(() => {
			logger.debug("Generating UI snapshot");
			const viewport = document.querySelector('[data-slot="scroll-area-viewport"]');
			return {
				scrollPosition: viewport?.scrollTop || 0,
				inputValue: chatState.inputValue || "",
			};
		});

		return () => unsubSnapshot();
	});

	onMount(() => {
		// 确保覆盖层状态重置
		fileUploadOverlayRef?.resetOverlay();

		// Listen for clear messages event from main process
		const unsubClear = window.electronAPI.onTabClearMessages(({ tabId, threadId }) => {
			logger.debug("Received clear messages event:", { tabId, threadId });
			// Clear the in-memory chat state
			chatState.clearMessages();
		});

		// Listen for generate title event from main process
		const unsubGenerateTitle = window.electronAPI.onTabGenerateTitle(
			async ({ tabId, threadId }) => {
				logger.debug("Received generate title event:", { tabId, threadId });
				// Generate title for the current chat
				await chatState.generateTitleManually();
			},
		);

		// Listen for trigger send message event (for branch and send)
		const unsubTriggerSend = window.electronAPI.onTriggerSendMessage(
			async (data: { threadId: string }) => {
				logger.debug("Received trigger-send-message event:", data);
				// Only trigger send if this is the target thread
				if (data.threadId === chatState.id) {
					// Wait a moment to ensure state is fully loaded
					await new Promise((resolve) => setTimeout(resolve, 100));
					// Trigger send if there's content
					if (chatState.sendMessageEnabled) {
						await chatState.sendMessage();
					}
				}
			},
		);

		// Listen for show toast event (from shell view, e.g. tab context menu)
		const unsubShowToast = window.electronAPI.onShowToast(
			(data: { type: string; message: string; threadId?: string }) => {
				logger.debug("Received show-toast event:", data);

				// Only show toast if it's for this specific thread (or no threadId specified)
				if (data.threadId && data.threadId !== chatState.id) {
					return;
				}

				// Display toast in this tab view (content area) so it's visible on top
				switch (data.type) {
					case "success":
						toast.success(data.message);
						break;
					case "error":
						toast.error(data.message);
						break;
					case "warning":
						toast.warning(data.message);
						break;
					case "info":
					default:
						toast.info(data.message);
						break;
				}
			},
		);

		// Listen for create skill summary event
		const unsubCreateSkillSummary = window.electronAPI.onTriggerCreateSkillSummary(
			async ({ threadId }: { threadId: string }) => {
				logger.debug("Received create-skill-summary event:", { threadId });

				// Only process if this is the target thread
				if (threadId === chatState.id) {
					chatState.isCreateSkillMode = true;
					chatState.inputValue =
						codeAgentState.type === "local"
							? `${m.create_skill_prompt_local()}`
							: `${m.create_skill_prompt()}`;
					await chatState.sendMessage();
					chatState.isCreateSkillMode = false;
				}
			},
		);

		// Listen for apply default model event from SSO login
		const unsubApplyDefaultModel = window.electronAPI.onApplyDefaultModel(
			(data: { model: unknown }) => {
				if (chatState.selectedModel === null && data.model) {
					chatState.selectedModel = data.model as Model;
				}
			},
		);

		// Check if we should auto-send on load (for branch and send functionality)
		const checkAutoSend = async () => {
			const threadKey = `app-thread:${chatState.id}`;
			const threadData = await window.electronAPI?.storageService?.getItem(threadKey);

			if (
				threadData &&
				typeof threadData === "object" &&
				(threadData as ThreadParmas).autoSendOnLoad === true
			) {
				logger.debug("Auto-send on load detected for thread:", chatState.id);

				// Clear the flag immediately to prevent re-sending
				await window.electronAPI.storageService.setItem(threadKey, {
					...(threadData as ThreadParmas),
					autoSendOnLoad: false,
				});

				// Wait a moment for the UI to fully initialize
				await new Promise((resolve) => setTimeout(resolve, 300));

				// Trigger AI reply generation
				// The user message is already in the message list, we just need to trigger AI response
				const currentModel = chatState.selectedModel;
				if (currentModel) {
					logger.debug("Triggering AI reply generation...");
					try {
						// Directly call chat.sendMessage with undefined to trigger AI reply
						// This won't add a new user message, just generate AI response
						await chat.sendMessage(undefined, {
							body: {
								model: currentModel.id,
								apiKey: persistedProviderState.current.find(
									(p) => p.id === currentModel.providerId,
								)?.apiKey,
							},
						});
					} catch (error) {
						logger.error("Failed to trigger AI reply:", error);
					}
				} else {
					logger.warn("Cannot auto-send: no model selected");
				}
			}
		};

		// Run auto-send check after a short delay to ensure state is loaded
		setTimeout(() => {
			checkAutoSend();
		}, 100);

		return () => {
			unsubClear();
			unsubGenerateTitle();
			unsubTriggerSend();
			unsubShowToast();
			unsubCreateSkillSummary();
			unsubApplyDefaultModel();
		};
	});

	// $effect(() => {
	// 	const sandBoxId = agentPreviewState.sandBoxId;
	// 	logger.debug("sandBoxIdsandBoxId", sandBoxId);
	// });

	// Close preview panel when code agent mode is disabled (but not in skills-only mode)
	$effect(() => {
		if (!codeAgentState.enabled && !agentPreviewState.isSkillsOnlyMode) {
			agentPreviewState.closePreview();
		}
	});

	// 仅在进入会话页时自动打开一次预览面板。
	// 用户手动关闭后，不应因后续消息发送再次自动打开。
	let hasAutoOpened = false;

	$effect(() => {
		const sandboxId = codeAgentState.sandboxId;
		const currentSessionId = codeAgentState.currentSessionId;

		if (!hasAutoOpened && codeAgentState.inCodeAgentMode && sandboxId && currentSessionId) {
			hasAutoOpened = true;
			agentPreviewState.openPreview(sandboxId);
		}
	});

	async function handleNewExploration() {
		await tabBarState.handleNewTab(m.title_new_chat(), "chat");
	}

	function handleClearScreen() {
		chatState.clearScreen();
	}

	function handleRestoreClearScreen() {
		chatState.restoreClearScreen();
	}
</script>

{#snippet ChatInputArea()}
	<div
		role="region"
		class="group/input relative flex flex-col items-center justify-center pb-6 px-4 pt-12"
		onmouseenter={() => (isInputAreaHovered = true)}
		onmouseleave={() => (isInputAreaHovered = false)}
	>
		<!-- New Exploration & Clear Screen Buttons -->

		{#if isInputAreaHovered && !chatState.isStreaming}
			<div
				class="absolute top-0 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 duration-200 flex items-center gap-2 max-w-[calc(100vw-2rem)]"
			>
				<button
					type="button"
					onclick={handleNewExploration}
					class="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-primary shadow-md backdrop-blur-sm transition-all hover:shadow-lg dark:bg-[#8334EF] dark:text-white dark:hover:bg-[#7029d6] sm:px-4"
				>
					<MessageSquarePlus class="h-4 w-4 shrink-0" />

					<span class="whitespace-nowrap">{m.text_new_exploration()}</span>
				</button>

				{#if chatState.hasVisibleMessages}
					<!-- Show clear screen button when there are visible messages -->

					<button
						type="button"
						onclick={handleClearScreen}
						class="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-muted-foreground shadow-md backdrop-blur-sm transition-all hover:shadow-lg hover:text-foreground dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white sm:px-4"
					>
						<Eraser class="h-4 w-4 shrink-0" />

						<span class="whitespace-nowrap">{m.text_clear_screen()}</span>
					</button>
				{/if}

				{#if chatState.hasClearScreen}
					<!-- Show restore button when there are hidden messages -->

					<button
						type="button"
						onclick={handleRestoreClearScreen}
						class="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-2 text-sm text-amber-600 shadow-md backdrop-blur-sm transition-all hover:shadow-lg dark:bg-amber-600 dark:text-white dark:hover:bg-amber-700 sm:px-4"
					>
						<History class="h-4 w-4 shrink-0" />

						<span class="whitespace-nowrap">{m.text_restore_history()}</span>
					</button>
				{/if}
			</div>
		{/if}

		{#if shouldShowTaskboardStatus}
			<div
				class="mb-3 flex w-full justify-center animate-in fade-in slide-in-from-bottom-2 duration-200"
			>
				<TaskboardStatusBar />
			</div>
		{/if}

		<ChatInputBox />
	</div>
{/snippet}

{#if !chatState.hasMessages && !agentPreviewState.isVisible}
	<!-- Initial state: no messages at all and no preview panel - show centered layout -->
	<div class="flex h-full flex-col relative">
		<PageHeader />
		<div class="flex flex-1 flex-col items-center justify-center gap-y-6">
			<div class="flex w-full flex-col items-center justify-center gap-chat-gap-y">
				<span class="text-center text-chat-slogan" data-layoutid="chat-slogan"
					>{m.app_slogan()}</span
				>
				<ChatInputBox />
			</div>
			{#if preferencesSettings.enableSupermarket}<AiApplicationItems />{/if}
		</div>
	</div>
{:else if !chatState.hasMessages && agentPreviewState.isVisible}
	<!-- Initial state with preview panel (skills-only mode) -->
	<div class="flex h-full overflow-hidden relative">
		{#if agentPreviewState.isPinned}
			<Resizable.PaneGroup direction="horizontal" class="h-full">
				<Resizable.Pane
					defaultSize={50}
					minSize={30}
					class="min-w-0"
					style="min-width: 450px;"
				>
					<div class="flex h-full flex-col relative">
						<PageHeader />
						<div class="flex flex-1 flex-col items-center justify-center gap-y-6">
							<div
								class="flex w-full flex-col items-center justify-center gap-chat-gap-y"
							>
								<span
									class="text-center text-chat-slogan"
									data-layoutid="chat-slogan">{m.app_slogan()}</span
								>
								<ChatInputBox />
							</div>
							{#if preferencesSettings.enableSupermarket}<AiApplicationItems />{/if}
						</div>
					</div>
				</Resizable.Pane>
				<Resizable.Handle withHandle class="mb-6" />
				<Resizable.Pane defaultSize={50} minSize={30} class="min-w-0 pb-6">
					<AgentPreviewPanel />
				</Resizable.Pane>
			</Resizable.PaneGroup>
		{:else}
			<div class="flex-1 flex flex-col h-full min-w-0 relative">
				<PageHeader />
				<div class="flex flex-1 flex-col items-center justify-center gap-y-6">
					<div class="flex w-full flex-col items-center justify-center gap-chat-gap-y">
						<span class="text-center text-chat-slogan" data-layoutid="chat-slogan"
							>{m.app_slogan()}</span
						>
						<ChatInputBox />
					</div>
					{#if preferencesSettings.enableSupermarket}<AiApplicationItems />{/if}
				</div>
			</div>
			<div
				class="absolute right-0 top-0 bottom-5 flex flex-col bg-background border-l border-border z-[50]"
				style="width: 50%;"
			>
				<button
					type="button"
					aria-label={m.title_resize_panel()}
					class="bg-border focus-visible:ring-ring absolute -left-px top-0 bottom-0 flex w-px cursor-col-resize items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden"
					onmousedown={setupPanelResize}
				>
					<div
						class="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border"
					>
						<GripVerticalIcon class="size-2.5" />
					</div>
				</button>
				<AgentPreviewPanel />
			</div>
		{/if}
	</div>
{:else if agentPreviewState.isVisible && !htmlPreviewState.isVisible}
	<div class="flex h-full overflow-hidden relative">
		{#if agentPreviewState.isPinned}
			<Resizable.PaneGroup direction="horizontal" class="h-full">
				<Resizable.Pane
					defaultSize={50}
					minSize={30}
					class="min-w-0"
					style="min-width: 450px;"
				>
					<div class="flex h-full flex-col min-w-0">
						<div class="flex-1 overflow-hidden relative">
							<PageHeader />
							<MessageList messages={chatState.visibleMessages} />
						</div>
						{@render ChatInputArea()}
					</div>
				</Resizable.Pane>
				<Resizable.Handle withHandle class="mb-6" />
				<Resizable.Pane defaultSize={50} minSize={30} class="min-w-0 pb-6">
					<AgentPreviewPanel />
				</Resizable.Pane>
			</Resizable.PaneGroup>
		{:else}
			<div class="flex-1 flex flex-col h-full min-w-0">
				<div class="flex-1 overflow-hidden relative">
					<PageHeader />
					<MessageList messages={chatState.visibleMessages} />
				</div>
				{@render ChatInputArea()}
			</div>
			<div
				class="absolute right-0 top-0 bottom-5 flex flex-col bg-background border-l border-border z-[50]"
				style="width: 50%;"
			>
				<button
					type="button"
					aria-label={m.title_resize_panel()}
					class="bg-border focus-visible:ring-ring absolute -left-px top-0 bottom-0 flex w-px cursor-col-resize items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden"
					onmousedown={setupPanelResize}
				>
					<div
						class="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border"
					>
						<GripVerticalIcon class="size-2.5" />
					</div>
				</button>
				<AgentPreviewPanel />
			</div>
		{/if}
	</div>
{:else if htmlPreviewState.isVisible && !agentPreviewState.isVisible}
	<div class="flex h-full overflow-hidden relative">
		{#if htmlPreviewState.isPinned}
			<Resizable.PaneGroup direction="horizontal" class="h-full">
				<Resizable.Pane
					defaultSize={50}
					minSize={30}
					class="min-w-0"
					style="min-width: 450px;"
				>
					<div class="flex h-full flex-col min-w-0">
						<div class="flex-1 overflow-hidden relative">
							<PageHeader />
							<MessageList messages={chatState.visibleMessages} />
						</div>
						{@render ChatInputArea()}
					</div>
				</Resizable.Pane>
				<Resizable.Handle withHandle class="mb-6" />
				<Resizable.Pane defaultSize={50} minSize={30} class="min-w-0 pb-6">
					<HtmlPreviewPanel />
				</Resizable.Pane>
			</Resizable.PaneGroup>
		{:else}
			<div class="flex-1 flex flex-col h-full min-w-0">
				<div class="flex-1 overflow-hidden relative">
					<PageHeader />
					<MessageList messages={chatState.visibleMessages} />
				</div>
				{@render ChatInputArea()}
			</div>
			<div
				class="absolute right-0 top-0 bottom-5 flex flex-col bg-background border-l border-border z-[50]"
				style="width: 50%;"
			>
				<button
					type="button"
					aria-label={m.title_resize_panel()}
					class="bg-border focus-visible:ring-ring absolute -left-px top-0 bottom-0 flex w-px cursor-col-resize items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden"
					onmousedown={setupPanelResize}
				>
					<div
						class="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-xs border"
					>
						<GripVerticalIcon class="size-2.5" />
					</div>
				</button>
				<HtmlPreviewPanel />
			</div>
		{/if}
	</div>
{:else}
	<div class="flex h-full flex-col gap-y-4">
		<div class="flex-1 overflow-hidden relative" data-layoutid="chat-message-list">
			<PageHeader />
			<MessageList messages={chatState.visibleMessages} />

			<!-- AgentPreviewPanel 需要始终挂载以监听状态，但当不在 Resizable 布局时隐藏 -->
			{#if !htmlPreviewState.isVisible && !agentPreviewState.isVisible}
				<AgentPreviewPanel />
			{/if}
		</div>
		{@render ChatInputArea()}
	</div>
{/if}

<!-- File Upload Overlay  -->
<FileUploadOverlay
	bind:this={fileUploadOverlayRef}
	onFilesAdded={handleFilesAdded}
	currentAttachmentCount={chatState.attachments.length}
/>

<!-- Busy Local Agent Confirmation Dialog -->
<Dialog.Root bind:open={codeAgentSendMessageButtonState.showBusyLocalAgentDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.title_busy_local_agent()}</Dialog.Title>
		</Dialog.Header>
		<Dialog.Description>
			{m.description_busy_local_agent()}
		</Dialog.Description>
		<Dialog.Footer class="flex flex-row items-center sm:justify-end gap-2">
			<Button
				variant="secondary"
				onclick={() => codeAgentSendMessageButtonState.handleBusyDialogCancel()}
			>
				{m.text_button_cancel()}
			</Button>
			<Button onclick={() => codeAgentSendMessageButtonState.handleBusyDialogConfirm()}>
				{m.text_button_confirm()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
