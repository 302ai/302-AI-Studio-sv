import { m } from "$lib/paraglide/messages";
import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
import { chatState } from "$lib/stores/chat-state.svelte";
import { codeAgentState } from "$lib/stores/code-agent";
import { modelPanelState } from "$lib/stores/model-panel-state.svelte";
import { persistedProviderState } from "$lib/stores/provider-state.svelte";
import { sidebarSearchState } from "$lib/stores/sidebar-search-state.svelte";
import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
import { threadsState } from "$lib/stores/threads-state.svelte";
import type { ShortcutActionEvent } from "@shared/types/shortcut";
import { toast } from "svelte-sonner";

export class ShortcutActionsHandler {
	private isInitialized = false;
	private cleanup?: () => void;

	init(): void {
		if (this.isInitialized || typeof window === "undefined" || !window.electronAPI) {
			return;
		}

		this.cleanup = window.electronAPI.shortcut.onShortcutAction((event: ShortcutActionEvent) => {
			this.handleAction(event);
		});

		this.isInitialized = true;
	}

	destroy(): void {
		if (this.cleanup) {
			this.cleanup();
			this.cleanup = undefined;
		}
		this.isInitialized = false;
	}

	private handleAction(event: ShortcutActionEvent): void {
		const { action } = event;

		try {
			switch (action) {
				case "sendMessage":
					// Handled by the chat input component directly
					break;
				case "clearMessages":
					this.handleClearMessages();
					break;
				case "stopGeneration":
					this.handleStopGeneration();
					break;
				case "regenerateResponse":
					this.handleRegenerateResponse();
					break;
				case "createBranch":
					this.handleCreateBranch();
					break;
				case "branchAndSend":
					this.handleBranchAndSend();
					break;
				case "toggleModelPanel":
					this.handleToggleModelPanel();
					break;
				case "toggleIncognitoMode":
					this.handleToggleIncognitoMode();
					break;
				case "deleteCurrentThread":
					this.handleDeleteCurrentThread();
					break;
				case "search":
					this.handleSearch();
					break;
				case "toggleSidebarRight":
					this.handleToggleSidebarRight();
					break;
				case "toggleChatParametersPanel":
					this.handleToggleChatParametersPanel();
					break;
				case "togglePlanMode":
					this.handleTogglePlanMode();
					break;

				default:
					console.warn(`Unhandled shortcut action: ${action}`);
			}
		} catch (error) {
			console.error(`Error handling shortcut action ${action}:`, error);
		}
	}

	private handleClearMessages(): void {
		chatState.clearMessages();
	}

	private handleStopGeneration(): void {
		chatState.stopGeneration();
	}

	private handleRegenerateResponse(): void {
		if (chatState.messages.length === 0) {
			// toast.error("No messages to regenerate");
			return;
		}
		chatState.regenerateMessage();
	}

	private async handleCreateBranch(): Promise<void> {
		if (chatState.messages.length === 0) {
			toast.error(m.toast_no_messages_to_branch());
			return;
		}

		// Create branch from the last message
		const lastMessage = chatState.messages[chatState.messages.length - 1];

		try {
			const newThreadId = await chatState.createBranch(lastMessage.id);
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

	private async handleBranchAndSend(): Promise<void> {
		if (chatState.messages.length === 0) {
			toast.error(m.toast_no_messages_to_branch());
			return;
		}

		// Check if there's content to send
		if (chatState.inputValue.trim() === "" && chatState.attachments.length === 0) {
			toast.error(m.toast_empty_message());
			return;
		}

		// Save the input content and attachments before branching
		const savedInputValue = chatState.inputValue;
		const savedAttachments = [...chatState.attachments];

		// Create branch from the last message
		const lastMessage = chatState.messages[chatState.messages.length - 1];

		try {
			// Use the new createBranchAndSend method that directly adds the user message
			const newThreadId = await chatState.createBranchAndSend(
				lastMessage.id,
				savedInputValue,
				savedAttachments,
			);

			if (newThreadId) {
				// Clear current thread's input
				chatState.inputValue = "";
				chatState.attachments = [];

				// Open the new thread in a new tab (this will reload the page with new threadId)
				// The user message will already be in the message list, not in the input box
				await tabBarState.handleNewTabForExistingThread(newThreadId);
			} else {
				toast.error(m.toast_unknown_error());
			}
		} catch (error) {
			console.error("Failed to branch and send:", error);
			toast.error(m.toast_unknown_error());
		}
	}

	private handleToggleModelPanel(): void {
		// Don't allow model selection when code agent is deleted
		if (codeAgentState.isDeleted) {
			return;
		}

		const hasConfiguredProviders = persistedProviderState.current.some(
			(provider) => provider.enabled && provider.apiKey && provider.apiKey.trim() !== "",
		);

		if (!hasConfiguredProviders) {
			toast.info(m.toast_no_provider_configured(), {
				action: {
					label: m.text_button_go_to_settings(),
					onClick: async () => {
						await tabBarState.handleNewTab(
							m.title_settings(),
							"settings",
							true,
							"/settings/model-settings",
						);
					},
				},
			});
			return;
		}

		modelPanelState.toggle();
	}

	private handleToggleIncognitoMode(): void {
		if (!chatState.canTogglePrivacy) {
			toast.error(m.title_incognito_disabled());
			return;
		}
		chatState.handlePrivateChatActiveChange(!chatState.isPrivateChatActive);
	}

	private async handleDeleteCurrentThread(): Promise<void> {
		// Get current active tab's threadId using real window tabs
		const currentTabs = await tabBarState.getCurrentWindowTabs();
		const activeTab = currentTabs?.find((tab) => tab.active);
		const threadId = activeTab?.threadId;

		// Check if there's a valid thread to delete (not shell and not undefined)
		if (!threadId || threadId === "shell") {
			return;
		}

		// Check if there are any threads to delete
		const threads = await threadsState.threads;
		if (!threads || threads.length === 0) {
			return;
		}

		// Check if the thread exists in the list
		const threadExists = threads.some((thread) => thread.threadId === threadId);
		if (!threadExists) {
			return;
		}

		// Delete thread first (before closing tab, which broadcasts "thread-list-updated")
		const success = await threadsState.deleteThread(threadId);
		if (!success) {
			console.error("Failed to delete thread:", threadId);
			return;
		}

		// Now close the tab — its broadcast will reload threads, but the deleted one is already gone
		if (activeTab) {
			await tabBarState.handleTabClose(activeTab.id);
		}
	}

	private handleSearch(): void {
		sidebarSearchState.triggerFocus();
		chatState.handleSearchInputStateChange(!chatState.isSearchInput);
	}

	private handleToggleSidebarRight(): void {
		if (!codeAgentState.inCodeAgentMode || !codeAgentState.sandboxId) return;
		if (agentPreviewState.isVisible) {
			agentPreviewState.closePreview();
		} else {
			agentPreviewState.openPreview(codeAgentState.sandboxId);
		}
	}

	private handleToggleChatParametersPanel(): void {
		chatState.isParametersOpen = !chatState.isParametersOpen;
	}

	private handleTogglePlanMode(): void {
		console.log(
			`[RendererActionsHandler] handleTogglePlanMode. Enabled: ${codeAgentState.enabled}, InPlanMode: ${codeAgentState.inPlanMode}`,
		);
		if (!codeAgentState.enabled) return;
		codeAgentState.updateInPlanMode(!codeAgentState.inPlanMode);
	}
}

export const shortcutActionsHandler = new ShortcutActionsHandler();
