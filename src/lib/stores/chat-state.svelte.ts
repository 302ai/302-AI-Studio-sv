import {
	ai302Handler,
	anthropicHandler,
	googleHandler,
	openaiHandler,
} from "$lib/handlers/chat-handlers";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { FChatTransport } from "$lib/transport/f-chat-transport";
import type { ChatMessage } from "$lib/types/chat";
import { ChatErrorHandler, type ChatError } from "$lib/utils/error-handler";
import { notificationState } from "./notification-state.svelte";

import type { ModelProvider } from "$lib/types/provider";
import { clone } from "$lib/utils/clone";
import { Chat } from "@ai-sdk/svelte";
import type { AttachmentFile, MCPServer, Model, ThreadParmas } from "@shared/types";
import { persistedProviderState, providerState } from "./provider-state.svelte";
import { tabBarState } from "./tab-bar-state.svelte";
import { convertAttachmentsToMessageParts } from "$lib/utils/attachment-converter";

const { broadcastService, threadService } = window.electronAPI;

export interface Thread {
	id: string;
}

const tab = window?.tab ?? null;
const threadId = tab?.threadId ?? "shell";
console.log("app-chat-messages:" + threadId);

const initialMessages = Array.isArray(window?.messages) ? clone(window.messages) : [];

const initialThread: ThreadParmas = clone(
	window?.thread ?? {
		id: threadId,
		title: "New Chat",
		inputValue: "",
		attachments: [],
		mcpServers: [],
		isThinkingActive: false,
		isOnlineSearchActive: false,
		isMCPActive: false,
		isPrivateChatActive: false,
		selectedModel: null,
		temperature: null,
		topP: null,
		maxTokens: null,
		frequencyPenalty: null,
		presencePenalty: null,
		updatedAt: new Date(),
	},
);

export const persistedMessagesState = new PersistedState<ChatMessage[]>(
	"app-chat-messages:" + threadId,
	initialMessages,
);
export const persistedChatParamsState = new PersistedState<ThreadParmas>(
	"app-thread:" + threadId,
	initialThread,
);

class ChatState {
	private lastError: ChatError | null = $state(null);
	private retryInProgress = $state(false);

	get inputValue(): string {
		return persistedChatParamsState.current.inputValue;
	}
	set inputValue(value: string) {
		persistedChatParamsState.current.inputValue = value;
	}

	get attachments(): AttachmentFile[] {
		return persistedChatParamsState.current.attachments;
	}
	set attachments(value: AttachmentFile[]) {
		persistedChatParamsState.current.attachments = value;
	}

	get messages(): ChatMessage[] {
		return chat.messages;
	}

	set messages(value: ChatMessage[]) {
		chat.messages = value;
	}

	get mcpServers(): MCPServer[] {
		return persistedChatParamsState.current.mcpServers;
	}
	set mcpServers(value: MCPServer[]) {
		persistedChatParamsState.current.mcpServers = value;
	}

	get isThinkingActive(): boolean {
		return persistedChatParamsState.current.isThinkingActive;
	}
	set isThinkingActive(value: boolean) {
		persistedChatParamsState.current.isThinkingActive = value;
	}

	get isOnlineSearchActive(): boolean {
		return persistedChatParamsState.current.isOnlineSearchActive;
	}
	set isOnlineSearchActive(value: boolean) {
		persistedChatParamsState.current.isOnlineSearchActive = value;
	}

	get isMCPActive(): boolean {
		return persistedChatParamsState.current.isMCPActive;
	}
	set isMCPActive(value: boolean) {
		persistedChatParamsState.current.isMCPActive = value;
	}

	get selectedModel(): Model | null {
		return persistedChatParamsState.current.selectedModel;
	}
	set selectedModel(value: Model | null) {
		persistedChatParamsState.current.selectedModel = value;
	}

	get isPrivateChatActive(): boolean {
		return persistedChatParamsState.current.isPrivateChatActive;
	}
	set isPrivateChatActive(value: boolean) {
		persistedChatParamsState.current.isPrivateChatActive = value;
	}

	get title(): string {
		return persistedChatParamsState.current.title;
	}
	set title(value: string) {
		persistedChatParamsState.current.title = value;
	}

	// Chat Parameters
	get temperature(): number | null {
		return persistedChatParamsState.current.temperature;
	}
	set temperature(value: number | null) {
		persistedChatParamsState.current.temperature = value;
	}

	get topP(): number | null {
		return persistedChatParamsState.current.topP;
	}
	set topP(value: number | null) {
		persistedChatParamsState.current.topP = value;
	}

	get frequencyPenalty(): number | null {
		return persistedChatParamsState.current.frequencyPenalty;
	}
	set frequencyPenalty(value: number | null) {
		persistedChatParamsState.current.frequencyPenalty = value;
	}

	get presencePenalty(): number | null {
		return persistedChatParamsState.current.presencePenalty;
	}
	set presencePenalty(value: number | null) {
		persistedChatParamsState.current.presencePenalty = value;
	}

	get maxTokens(): number | null {
		return persistedChatParamsState.current.maxTokens;
	}
	set maxTokens(value: number | null) {
		persistedChatParamsState.current.maxTokens = value;
	}
	providerType = $derived<string | null>(
		this.selectedModel
			? (providerState.getProvider(this.selectedModel.providerId)?.apiType ?? null)
			: null,
	);
	currentProvider = $derived<ModelProvider | null>(
		this.selectedModel ? providerState.getProvider(this.selectedModel.providerId) : null,
	);
	sendMessageEnabled = $derived<boolean>(
		(this.inputValue.trim() !== "" || this.attachments.length > 0) && !!this.selectedModel,
	);
	hasMessages = $derived(this.messages.length > 0);
	canTogglePrivacy = $derived(!this.hasMessages);

	isStreaming = $derived(chat.status === "streaming");
	isSubmitted = $derived(chat.status === "submitted");
	isReady = $derived(chat.status === "ready");
	isError = $derived(chat.status === "error");
	canRegenerate = $derived(
		(this.isReady || this.isError) &&
			this.hasMessages &&
			!!this.selectedModel &&
			this.messages.some((msg) => msg.role === "assistant"),
	);
	lastAssistantMessage = $derived(this.messages.findLast((msg) => msg.role === "assistant"));

	isLastMessageStreaming = $derived(this.isStreaming && this.hasMessages);

	get hasError(): boolean {
		return this.lastError !== null;
	}

	get canRetry(): boolean {
		return (
			this.hasError &&
			!this.retryInProgress &&
			this.lastError !== null &&
			ChatErrorHandler.isRetryable(this.lastError) &&
			notificationState.canRetry
		);
	}

	private handleChatError = (error: unknown) => {
		const chatError = ChatErrorHandler.createError(error, {
			provider: this.currentProvider?.name,
			model: this.selectedModel?.id,
			action: "send_message",
			retryable: true,
		});

		this.lastError = chatError;
		notificationState.setError(chatError);
		ChatErrorHandler.showErrorNotification(chatError);
	};

	private resetError = () => {
		this.lastError = null;
		notificationState.clearError();
	};

	retryLastMessage = async () => {
		if (!this.canRetry || !this.lastError) {
			return;
		}

		this.retryInProgress = true;
		notificationState.incrementRetryCount();

		try {
			const retryDelay = ChatErrorHandler.getRetryDelay(this.lastError);
			if (retryDelay > 0) {
				await new Promise((resolve) => setTimeout(resolve, retryDelay));
			}

			this.resetError();

			if (this.hasMessages && this.messages.length > 0) {
				await this.regenerateMessage();
			}
		} catch (error) {
			this.handleChatError(error);
		} finally {
			this.retryInProgress = false;
		}
	};

	sendMessage = async () => {
		if (this.sendMessageEnabled) {
			try {
				const currentModel = this.selectedModel!;
				const currentAttachments = [...this.attachments];
				const currentInputValue = this.inputValue;

				this.resetError();

				const { parts: attachmentParts, metadataList: attachmentMetadata } =
					await convertAttachmentsToMessageParts(currentAttachments);

				const textParts = attachmentParts.filter(
					(part): part is { type: "text"; text: string } => part.type === "text",
				);
				const fileParts = attachmentParts.filter(
					(part): part is import("ai").FileUIPart => part.type === "file",
				);

				if (fileParts.length > 0 && textParts.length > 0) {
					const fileContent = textParts.map((part) => part.text).join("\n\n");

					chat.sendMessage(
						{
							parts: [
								...fileParts,
								{ type: "text" as const, text: fileContent },
								{ type: "text" as const, text: currentInputValue },
							],
							metadata: {
								attachments: attachmentMetadata,
								fileContentPartIndex: fileParts.length,
							},
						},
						{
							body: {
								model: currentModel.id,
								apiKey: persistedProviderState.current.find((p) => p.id === currentModel.providerId)
									?.apiKey,
							},
						},
					);
				} else if (fileParts.length > 0) {
					chat.sendMessage(
						{
							text: currentInputValue,
							files: fileParts,
							metadata: { attachments: attachmentMetadata },
						},
						{
							body: {
								model: currentModel.id,
								apiKey: persistedProviderState.current.find((p) => p.id === currentModel.providerId)
									?.apiKey,
							},
						},
					);
				} else if (textParts.length > 0) {
					const fileContent = textParts.map((part) => part.text).join("\n\n");

					chat.sendMessage(
						{
							parts: [
								{ type: "text" as const, text: fileContent },
								{ type: "text" as const, text: currentInputValue },
							],
							metadata: {
								attachments: attachmentMetadata,
								fileContentPartIndex: 0,
							},
						},
						{
							body: {
								model: currentModel.id,
								apiKey: persistedProviderState.current.find((p) => p.id === currentModel.providerId)
									?.apiKey,
							},
						},
					);
				} else {
					chat.sendMessage(
						{ text: currentInputValue },
						{
							body: {
								model: currentModel.id,
								apiKey: persistedProviderState.current.find((p) => p.id === currentModel.providerId)
									?.apiKey,
							},
						},
					);
				}

				threadService.addThread(persistedChatParamsState.current.id);

				this.inputValue = "";
				this.attachments = [];
			} catch (error) {
				this.handleChatError(error);
			}
		}
	};

	regenerateMessage = async (messageId?: string) => {
		if (!this.canRegenerate) {
			console.warn("Cannot regenerate: chat is not ready or no model selected");
			return;
		}

		const currentModel = this.selectedModel!;

		try {
			this.resetError();

			await chat.regenerate({
				...(messageId && { messageId }),
				body: {
					model: currentModel.id,
					apiKey: persistedProviderState.current.find((p) => p.id === currentModel.providerId)
						?.apiKey,
				},
			});
		} catch (error) {
			console.error("Failed to regenerate message:", error);
			this.handleChatError(error);
		}
	};

	stopGeneration = () => {
		chat.stop();
	};

	clearMessages() {
		this.messages = [];
	}

	updateMessage(messageId: string, content: string) {
		const updatedMessages = this.messages.map((msg) => {
			if (msg.id === messageId) {
				return {
					...msg,
					parts: msg.parts.map((part) =>
						part.type === "text" ? { ...part, text: content } : part,
					),
				};
			}
			return msg;
		});

		chat.messages = updatedMessages;
	}

	addAttachment(attachment: AttachmentFile) {
		this.attachments = [...this.attachments, attachment];
	}

	addAttachments(attachments: AttachmentFile[]) {
		this.attachments = [...this.attachments, ...attachments];
	}

	removeAttachment(id: string) {
		this.attachments = this.attachments.filter((att) => att.id !== id);
	}

	handleThinkingActiveChange(active: boolean) {
		this.isThinkingActive = active;
	}

	handleOnlineSearchActiveChange(active: boolean) {
		this.isOnlineSearchActive = active;
	}

	handleMCPActiveChange(active: boolean) {
		this.isMCPActive = active;
	}

	handleSelectedModelChange(model: Model | null) {
		this.selectedModel = model;
	}

	handlePrivateChatActiveChange(active: boolean) {
		this.isPrivateChatActive = active;
	}

	handleTemperatureChange(value: number | null) {
		this.temperature = value;
	}

	handleTopPChange(value: number | null) {
		this.topP = value;
	}

	handleFrequencyPenaltyChange(value: number | null) {
		this.frequencyPenalty = value;
	}

	handlePresencePenaltyChange(value: number | null) {
		this.presencePenalty = value;
	}

	handleMaxTokensChange(value: number | null) {
		this.maxTokens = value;
	}
}

export const chatState = new ChatState();

export const chat = new Chat({
	messages: persistedMessagesState.current,
	transport: new FChatTransport<ChatMessage>({
		handler: () => {
			switch (chatState.currentProvider?.apiType) {
				case "302ai":
					return ai302Handler;
				case "openai":
					return openaiHandler;
				case "anthropic":
					return anthropicHandler;
				case "gemini":
					return googleHandler;
				default:
					return ai302Handler;
			}
		},
		body: () => ({
			baseUrl: chatState.currentProvider?.baseUrl,
			temperature: persistedChatParamsState.current.temperature,
			topP: persistedChatParamsState.current.topP,
			maxTokens: persistedChatParamsState.current.maxTokens,
			frequencyPenalty: persistedChatParamsState.current.frequencyPenalty,
			presencePenalty: persistedChatParamsState.current.presencePenalty,

			isThinkingActive: persistedChatParamsState.current.isThinkingActive,
			isOnlineSearchActive: persistedChatParamsState.current.isOnlineSearchActive,
			isMCPActive: persistedChatParamsState.current.isMCPActive,
		}),
	}),
	onFinish: ({ messages }) => {
		console.log("更新完成", $state.snapshot(messages));
		persistedMessagesState.current = messages;

		// Update thread title with first user message if title is empty or default
		const isFirstMessage = messages.length === 2; // User message + AI response
		const currentTitle = persistedChatParamsState.current.title;
		const isDefaultTitle =
			!currentTitle || currentTitle === "New Chat" || currentTitle === "新对话";

		if (isFirstMessage && isDefaultTitle) {
			const firstUserMessage = messages.find((msg) => msg.role === "user");
			if (firstUserMessage) {
				// Extract text content from the first text part
				const textPart = firstUserMessage.parts.find((part) => part.type === "text");
				if (textPart && "text" in textPart) {
					// Get first 10 characters (considering emoji and multibyte characters)
					const text = textPart.text.trim();
					const titleText = [...text].slice(0, 10).join("");
					persistedChatParamsState.current.title = titleText;
					tabBarState.updateTabTitle(persistedChatParamsState.current.id, titleText);
				}
			}
		}

		// Update the updatedAt timestamp
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		persistedChatParamsState.current.updatedAt = new Date();

		broadcastService.broadcastToAll("thread-list-updated", {});
	},
});
