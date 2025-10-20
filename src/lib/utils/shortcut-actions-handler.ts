import { m } from "$lib/paraglide/messages";
import { chatState } from "$lib/stores/chat-state.svelte";
import { modelPanelState } from "$lib/stores/model-panel-state.svelte";
import { persistedProviderState } from "$lib/stores/provider-state.svelte";
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
			toast.error("No messages to regenerate");
			return;
		}
		chatState.regenerateMessage();
	}

	private async handleCreateBranch(): Promise<void> {
		if (chatState.messages.length === 0) {
			toast.error("No messages to branch from");
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

	private handleBranchAndSend(): void {
		if (chatState.messages.length === 0) {
			toast.error("No messages to branch from");
			return;
		}
		// TODO: Implement branch and send logic
		console.log("Branch and send shortcut triggered");
	}

	private handleToggleModelPanel(): void {
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
		// Get current active tab's threadId
		const activeTab = tabBarState.tabs.find((tab) => tab.active);
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

		// Close the tab if it's open
		if (activeTab) {
			await tabBarState.handleTabClose(activeTab.id);
		}

		// Delete the thread
		const success = await threadsState.deleteThread(threadId);
		if (!success) {
			console.error("Failed to delete thread:", threadId);
		}
	}
}

export const shortcutActionsHandler = new ShortcutActionsHandler();
