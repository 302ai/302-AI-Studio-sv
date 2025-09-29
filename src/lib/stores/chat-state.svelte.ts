import {
	ai302Handler,
	anthropicHandler,
	googleHandler,
	openaiHandler,
} from "$lib/handlers/chat-handlers";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { FChatTransport } from "$lib/transport/f-chat-transport";
import type { ChatMessage } from "$lib/types/chat";

import type { ModelProvider } from "$lib/types/provider";
import { clone } from "$lib/utils/clone";
import { Chat } from "@ai-sdk/svelte";
import type { AttachmentFile, MCPServer, Model, ThreadParmas } from "@shared/types";
import { persistedProviderState, providerState } from "./provider-state.svelte";

export interface Thread {
	id: string;
}

// Updated ChatMessage interface using the standardized Model type
// Chat parameters interface

console.log("app-chat-messages:" + window.tab.threadId);
export const persistedMessagesState = new PersistedState<ChatMessage[]>(
	"app-chat-messages:" + window.tab.threadId,
	clone(window.messages),
);
export const persistedChatParamsState = new PersistedState<ThreadParmas>(
	"app-thread:" + window.tab.threadId,
	clone(window.thread),
);

class ChatState {
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
			? (providerState.getProvider(this.selectedModel.providerId)?.name ?? null)
			: null,
	);
	currentProvider = $derived<ModelProvider | null>(
		this.selectedModel ? providerState.getProvider(this.selectedModel.providerId) : null,
	);
	sendMessageEnabled = $derived<boolean>(
		(this.inputValue.trim() !== "" || this.attachments.length > 0) && !!this.selectedModel,
	);
	hasMessages = $derived(this.messages.length > 0);

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

	sendMessage = () => {
		if (this.sendMessageEnabled) {
			const currentModel = this.selectedModel!;

			chat.sendMessage(
				{ text: this.inputValue },
				{
					body: {
						model: currentModel.id,
						apiKey: persistedProviderState.current.find((p) => p.id === currentModel.providerId)
							?.apiKey,
					},
				},
			);

			this.inputValue = "";
			this.attachments = [];
		}
	};

	regenerateMessage = async (messageId?: string) => {
		if (!this.canRegenerate) {
			console.warn("Cannot regenerate: chat is not ready or no model selected");
			return;
		}

		const currentModel = this.selectedModel!;

		try {
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
	},
});
