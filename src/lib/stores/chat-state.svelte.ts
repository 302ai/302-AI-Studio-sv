import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { ChatMessage } from "$lib/types/chat";
import { ChatErrorHandler, type ChatError } from "$lib/utils/error-handler";
import { notificationState } from "./notification-state.svelte";

import { generateTitle } from "$lib/api/title-generation";
import { m } from "$lib/paraglide/messages.js";
import { DynamicChatTransport } from "$lib/transport/dynamic-chat-transport";
import {
	convertAttachmentsToMessageParts,
	type MessagePart,
} from "$lib/utils/attachment-converter";
import { clone } from "$lib/utils/clone";
import { Chat } from "@ai-sdk/svelte";
import type { ModelProvider } from "@shared/storage/provider";
import type { AttachmentFile, MCPServer, Model, ThreadParmas } from "@shared/types";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";
import { preferencesSettings } from "./preferences-settings.state.svelte";
import { persistedProviderState, providerState } from "./provider-state.svelte";
import { tabBarState } from "./tab-bar-state.svelte";

const { broadcastService, threadService, storageService, pluginService } = window.electronAPI;

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
		mcpServerIds: [],
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
	true,  // Enable debouncing
	1000,  // 1 second delay (messages are less time-sensitive)
);
export const persistedChatParamsState = new PersistedState<ThreadParmas>(
	"app-thread:" + threadId,
	initialThread,
	true,  // Enable debouncing
	500,   // 500ms delay for chat parameters
);

class ChatState {
	private lastError: ChatError | null = $state(null);
	private retryInProgress = $state(false);

	get id(): string {
		return persistedChatParamsState.current.id;
	}

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

	get mcpServerIds(): string[] {
		return persistedChatParamsState.current.mcpServerIds;
	}
	set mcpServerIds(value: string[]) {
		persistedChatParamsState.current.mcpServerIds = value;
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

	isStreaming = $derived(chat.status === "streaming");
	isSubmitted = $derived(chat.status === "submitted");
	isReady = $derived(chat.status === "ready");
	isError = $derived(chat.status === "error");

	sendMessageEnabled = $derived<boolean>(
		(this.inputValue.trim() !== "" || this.attachments.length > 0) &&
			!!this.selectedModel &&
			!this.isStreaming &&
			!this.isSubmitted,
	);
	hasMessages = $derived(this.messages.length > 0);
	canTogglePrivacy = $derived(!this.hasMessages);
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

	private handleChatError = async (error: unknown) => {
		const chatError = ChatErrorHandler.createError(error, {
			provider: this.currentProvider?.name,
			model: this.selectedModel?.id,
			action: "send_message",
			retryable: true,
		});

		this.lastError = chatError;

		// Execute error hook
		try {
			const errorContext = {
				source: "send_message" as const,
				provider: this.currentProvider || undefined,
				model: this.selectedModel || undefined,
				metadata: {
					errorType: chatError.type,
					statusCode: chatError.statusCode,
				},
			};

			const hookResult = await pluginService.executeErrorHook(
				{
					message:
						chatError.originalError instanceof Error
							? chatError.originalError.message
							: String(chatError.originalError),
					stack:
						chatError.originalError instanceof Error ? chatError.originalError.stack : undefined,
					name: chatError.originalError instanceof Error ? chatError.originalError.name : "Error",
				},
				errorContext,
			);

			if (hookResult.handled) {
				console.log("[ChatState] Error handled by plugin hook");

				// If plugin suggests custom message, use it
				if (hookResult.message) {
					notificationState.setError({
						...chatError,
						message: hookResult.message,
					});
				} else {
					notificationState.setError(chatError);
				}

				// If plugin suggests retry
				if (hookResult.retry) {
					const retryDelay = hookResult.retryDelay || 0;
					if (retryDelay > 0) {
						await new Promise((resolve) => setTimeout(resolve, retryDelay));
					}
					await this.retryLastMessage();
					return;
				}
			} else {
				// Default error handling
				notificationState.setError(chatError);
				ChatErrorHandler.showErrorNotification(chatError);
			}
		} catch (hookError) {
			console.error("[ChatState] Error hook failed:", hookError);
			// Fallback to default error handling
			notificationState.setError(chatError);
			ChatErrorHandler.showErrorNotification(chatError);
		}
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

				// Execute before send message hook
				try {
					const messageContext = {
						messages: this.messages,
						userMessage: this.messages.at(-1),
						model: currentModel,
						provider: this.currentProvider!,
						parameters: {
							temperature: this.temperature,
							topP: this.topP,
							maxTokens: this.maxTokens,
							frequencyPenalty: this.frequencyPenalty,
							presencePenalty: this.presencePenalty,
						},
						options: {
							isThinkingActive: this.isThinkingActive,
							isOnlineSearchActive: this.isOnlineSearchActive,
							isMCPActive: this.isMCPActive,
							mcpServerIds: this.mcpServerIds,
							autoParseUrl: preferencesSettings.autoParseUrl,
							speedOptions: {
								enabled: preferencesSettings.streamOutputEnabled,
								speed: preferencesSettings.streamSpeed,
							},
						},
					};

					// Serialize context to remove Svelte Proxy objects
					const serializedContext = JSON.parse(JSON.stringify(messageContext));

					const modifiedContext =
						await pluginService.executeBeforeSendMessageHook(serializedContext);

					// Check if hook cancelled the message
					if (
						modifiedContext &&
						typeof modifiedContext === "object" &&
						"stop" in modifiedContext &&
						modifiedContext.stop === true
					) {
						console.log("[ChatState] Message sending cancelled by plugin hook");
						return;
					}

					console.log("[ChatState] Before send message hook executed successfully");
				} catch (hookError) {
					console.error("[ChatState] Before send message hook failed:", hookError);
					// Continue with message sending even if hook fails
				}

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

				broadcastService.broadcastToAll("thread-list-updated", { threadId });

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
		persistedMessagesState.current = [];
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

	deleteMessage(messageId: string) {
		const updatedMessages = this.messages.filter((msg) => msg.id !== messageId);
		chat.messages = updatedMessages;
		persistedMessagesState.current = updatedMessages;
	}

	rerunToolCall = async (messageId: string, toolCallId: string) => {
		if (!this.canRegenerate) {
			console.warn("Cannot rerun tool: chat is not ready or no model selected");
			return;
		}

		const messageIndex = this.messages.findIndex((msg) => msg.id === messageId);
		if (messageIndex === -1) {
			throw new Error("Message not found");
		}

		const message = this.messages[messageIndex];
		if (!message) {
			throw new Error("Message not found");
		}

		const toolCallPartIndex = message.parts.findIndex(
			(part) => part.type === "dynamic-tool" && part.toolCallId === toolCallId,
		);

		if (toolCallPartIndex === -1) {
			throw new Error("Tool call not found");
		}
		const updatedParts = message.parts.slice(0, toolCallPartIndex);
		const updatedMessage = { ...message, parts: updatedParts };
		const updatedMessages = [...this.messages.slice(0, messageIndex), updatedMessage];

		chat.messages = updatedMessages;
		persistedMessagesState.current = updatedMessages;

		const currentModel = this.selectedModel!;

		try {
			this.resetError();
			await chat.sendMessage(undefined, {
				body: {
					model: currentModel.id,
					apiKey: persistedProviderState.current.find((p) => p.id === currentModel.providerId)
						?.apiKey,
				},
			});
		} catch (error) {
			console.error("Failed to rerun tool call:", error);
			this.handleChatError(error);
		}
	};

	async generateTitleManually(): Promise<void> {
		const titleModel = preferencesSettings.titleGenerationModel;

		if (!titleModel) {
			console.warn("No title generation model configured");
			toast.warning(m.toast_no_title_generation_model());
			return;
		}

		if (this.messages.length < 2) {
			console.warn("Not enough messages to generate title");
			toast.warning(m.toast_empty_message());
			return;
		}

		try {
			const provider = persistedProviderState.current.find((p) => p.id === titleModel.providerId);
			const serverPort = window.app?.serverPort ?? 8089;

			const generatedTitle = await generateTitle(this.messages, titleModel, provider, serverPort);

			if (generatedTitle) {
				persistedChatParamsState.current.title = generatedTitle;
				tabBarState.updateTabTitle(persistedChatParamsState.current.id, generatedTitle);

				// Broadcast update event to trigger sidebar refresh
				await broadcastService.broadcastToAll("thread-list-updated", {});

				toast.success(m.toast_title_generation_success());
			} else {
				toast.error(m.toast_title_generation_failed());
			}
		} catch (error) {
			console.error("Failed to generate title manually:", error);
			toast.error(m.toast_title_generation_failed());
		}
	}

	async createBranch(upToMessageId: string): Promise<string | null> {
		try {
			// 1. find the target message index
			const messageIndex = this.messages.findIndex((msg) => msg.id === upToMessageId);
			if (messageIndex === -1) {
				console.error("Message not found:", upToMessageId);
				return null;
			}

			// 2. slice messages
			const branchMessages = clone(this.messages.slice(0, messageIndex + 1));

			// 3. generate threadId
			const newThreadId = nanoid();

			// 4. clone thread data
			const newThread: ThreadParmas = clone({
				id: newThreadId,
				title: `${this.title}`,
				inputValue: "",
				attachments: [],
				mcpServers: this.mcpServers,
				mcpServerIds: persistedChatParamsState.current.mcpServerIds || [],
				isThinkingActive: this.isThinkingActive,
				isOnlineSearchActive: this.isOnlineSearchActive,
				isMCPActive: this.isMCPActive,
				isPrivateChatActive: this.isPrivateChatActive,
				selectedModel: this.selectedModel,
				temperature: this.temperature,
				topP: this.topP,
				maxTokens: this.maxTokens,
				frequencyPenalty: this.frequencyPenalty,
				presencePenalty: this.presencePenalty,
				updatedAt: new Date(),
			});

			// 5. save thread data
			await storageService.setItem(`app-thread:${newThreadId}`, newThread);
			await storageService.setItem(`app-chat-messages:${newThreadId}`, branchMessages);

			// 6. add to thread list
			await threadService.addThread(newThreadId);

			// 7. broadcast thread list update
			await broadcastService.broadcastToAll("thread-list-updated", {});

			return newThreadId;
		} catch (error) {
			console.error("Failed to create branch:", error);
			return null;
		}
	}

	async createBranchAndSend(
		upToMessageId: string,
		userInput: string,
		userAttachments: AttachmentFile[],
	): Promise<string | null> {
		try {
			// 1. find the target message index
			const messageIndex = this.messages.findIndex((msg) => msg.id === upToMessageId);
			if (messageIndex === -1) {
				console.error("Message not found:", upToMessageId);
				return null;
			}

			// 2. slice messages up to and including the target message
			const branchMessages = clone(this.messages.slice(0, messageIndex + 1));

			// 3. convert attachments to message parts
			const { parts: attachmentParts, metadataList: attachmentMetadata } =
				await convertAttachmentsToMessageParts(userAttachments);

			// 4. Separate text and file parts
			const textParts = attachmentParts.filter(
				(part): part is { type: "text"; text: string } => part.type === "text",
			);
			const fileParts = attachmentParts.filter(
				(part): part is import("ai").FileUIPart => part.type === "file",
			);

			// 5. Build message parts array - always include at least the user input as a text part
			let messageParts: MessagePart[] = [];
			let fileContentPartIndex: number | undefined = undefined;

			if (fileParts.length > 0 && textParts.length > 0) {
				// Has both files and text content from files
				const fileContent = textParts.map((part) => part.text).join("\n\n");
				messageParts = [
					...fileParts,
					{ type: "text" as const, text: fileContent },
					{ type: "text" as const, text: userInput },
				];
				fileContentPartIndex = fileParts.length;
			} else if (fileParts.length > 0) {
				// Has only files
				messageParts = [...fileParts, { type: "text" as const, text: userInput }];
			} else if (textParts.length > 0) {
				// Has only text content from files
				const fileContent = textParts.map((part) => part.text).join("\n\n");
				messageParts = [
					{ type: "text" as const, text: fileContent },
					{ type: "text" as const, text: userInput },
				];
				fileContentPartIndex = 0;
			} else {
				// No attachments, just user input
				messageParts = [{ type: "text" as const, text: userInput }];
			}

			// 6. Create user message with proper structure
			const userMessage: ChatMessage = {
				id: nanoid(),
				role: "user",
				parts: messageParts,
				metadata: {
					createdAt: new Date().toISOString(),
					attachments: attachmentMetadata,
					...(fileContentPartIndex !== undefined && { fileContentPartIndex }),
				},
			};

			// 7. add user message to branch messages
			branchMessages.push(userMessage);

			// 8. generate threadId
			const newThreadId = nanoid();

			// 9. clone thread data with autoSendOnLoad flag
			const newThread: ThreadParmas = clone({
				id: newThreadId,
				title: `${this.title}`,
				inputValue: "", // Keep input empty
				attachments: [], // Keep attachments empty
				mcpServers: this.mcpServers,
				mcpServerIds: persistedChatParamsState.current.mcpServerIds || [],
				isThinkingActive: this.isThinkingActive,
				isOnlineSearchActive: this.isOnlineSearchActive,
				isMCPActive: this.isMCPActive,
				isPrivateChatActive: this.isPrivateChatActive,
				selectedModel: this.selectedModel,
				temperature: this.temperature,
				topP: this.topP,
				maxTokens: this.maxTokens,
				frequencyPenalty: this.frequencyPenalty,
				presencePenalty: this.presencePenalty,
				updatedAt: new Date(),
				autoSendOnLoad: true, // Set flag to trigger AI reply on load
			});

			// 8. save thread data and messages
			await storageService.setItem(`app-thread:${newThreadId}`, newThread);
			await storageService.setItem(`app-chat-messages:${newThreadId}`, branchMessages);

			// 9. add to thread list
			await threadService.addThread(newThreadId);

			// 10. broadcast thread list update
			await broadcastService.broadcastToAll("thread-list-updated", {});

			return newThreadId;
		} catch (error) {
			console.error("Failed to create branch and send:", error);
			return null;
		}
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

	handleMCPServerIdsChange(serverIds: string[]) {
		this.mcpServerIds = serverIds;
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
	transport: new DynamicChatTransport<ChatMessage>({
		api: () => {
			const port = window.app?.serverPort ?? 8089;
			switch (chatState.currentProvider?.apiType) {
				case "302ai":
					return `http://localhost:${port}/chat/302ai`;
				case "openai":
					return `http://localhost:${port}/chat/openai`;
				case "anthropic":
					return `http://localhost:${port}/chat/anthropic`;
				case "gemini":
					return `http://localhost:${port}/chat/gemini`;
				default:
					return `http://localhost:${port}/chat/302`;
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
			mcpServerIds: persistedChatParamsState.current.mcpServerIds,

			autoParseUrl: preferencesSettings.autoParseUrl,

			speedOptions: {
				enabled: preferencesSettings.streamOutputEnabled,
				speed: preferencesSettings.streamSpeed,
			},
		}),
	}),
	onFinish: async ({ messages }) => {
		console.log("更新完成", $state.snapshot(messages));
		persistedMessagesState.current = messages;

		// Execute after send message hook
		try {
			const lastMessage = messages[messages.length - 1];
			const userMessage = messages[messages.length - 2]; // Assuming last is AI, second-to-last is user

			if (lastMessage && userMessage && chatState.selectedModel && chatState.currentProvider) {
				const messageContext = {
					messages: messages,
					userMessage: userMessage,
					model: chatState.selectedModel,
					provider: chatState.currentProvider,
					parameters: {
						temperature: chatState.temperature,
						topP: chatState.topP,
						maxTokens: chatState.maxTokens,
						frequencyPenalty: chatState.frequencyPenalty,
						presencePenalty: chatState.presencePenalty,
					},
					options: {
						isThinkingActive: chatState.isThinkingActive,
						isOnlineSearchActive: chatState.isOnlineSearchActive,
						isMCPActive: chatState.isMCPActive,
						mcpServerIds: chatState.mcpServerIds,
						autoParseUrl: preferencesSettings.autoParseUrl,
						speedOptions: {
							enabled: preferencesSettings.streamOutputEnabled,
							speed: preferencesSettings.streamSpeed,
						},
					},
				};

				const response = {
					message: lastMessage,
					usage: undefined,
					model: chatState.selectedModel.id,
					finishReason: "stop",
					metadata: {},
				};

				// Serialize context and response to remove Svelte Proxy objects
				const serializedContext = JSON.parse(JSON.stringify(messageContext));
				const serializedResponse = JSON.parse(JSON.stringify(response));

				await pluginService.executeAfterSendMessageHook(serializedContext, serializedResponse);
				console.log("[ChatState] After send message hook executed successfully");
			}
		} catch (hookError) {
			console.error("[ChatState] After send message hook failed:", hookError);
			// Continue execution even if hook fails
		}

		const titleTiming = preferencesSettings.titleGenerationTiming;
		const titleModel = preferencesSettings.titleGenerationModel;
		const currentTitle = persistedChatParamsState.current.title;
		const isDefaultTitle =
			!currentTitle ||
			currentTitle === "New Chat" ||
			currentTitle === "新对话" ||
			currentTitle === "新会话";
		const isFirstMessage = messages.length === 2; // User message + AI response

		let shouldGenerateTitle = false;

		if (titleTiming === "off") {
			shouldGenerateTitle = false;
		} else if (titleTiming === "firstTime") {
			shouldGenerateTitle = isFirstMessage && isDefaultTitle;
		} else if (titleTiming === "everyTime") {
			shouldGenerateTitle = messages.length >= 2;
		}

		if (shouldGenerateTitle && titleModel) {
			try {
				const provider = persistedProviderState.current.find((p) => p.id === titleModel.providerId);
				const serverPort = window.app?.serverPort ?? 8089;

				const generatedTitle = await generateTitle(messages, titleModel, provider, serverPort);
				persistedChatParamsState.current.title = generatedTitle;
				tabBarState.updateTabTitle(persistedChatParamsState.current.id, generatedTitle);
			} catch (error) {
				console.error("Failed to generate title:", error);
			}
		} else if (isFirstMessage && isDefaultTitle && titleTiming !== "off") {
			// Fallback for firstTime mode when model is not configured
			const firstUserMessage = messages.find((msg) => msg.role === "user");
			if (firstUserMessage) {
				const textPart = firstUserMessage.parts.find((part) => part.type === "text");
				if (textPart && "text" in textPart) {
					const text = textPart.text.trim();
					const titleText = [...text].slice(0, 10).join("");
					if (titleText) {
						persistedChatParamsState.current.title = titleText;
						tabBarState.updateTabTitle(persistedChatParamsState.current.id, titleText);
					}
				}
			}
		}

		// Update the updatedAt timestamp
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		persistedChatParamsState.current.updatedAt = new Date();

		broadcastService.broadcastToAll("thread-list-updated", {});
	},
});
