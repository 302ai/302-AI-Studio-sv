import { chatState } from "$lib/stores/chat-state.svelte";
import { modelPanelState } from "$lib/stores/model-panel-state.svelte";
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

	private handleCreateBranch(): void {
		if (chatState.messages.length === 0) {
			toast.error("No messages to branch from");
			return;
		}
		// TODO: Implement branch creation logic
		console.log("Create branch shortcut triggered");
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
		modelPanelState.toggle();
	}

	private handleToggleIncognitoMode(): void {
		chatState.isPrivateChatActive = !chatState.isPrivateChatActive;
	}
}

export const shortcutActionsHandler = new ShortcutActionsHandler();
