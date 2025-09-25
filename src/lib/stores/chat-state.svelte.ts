import { openaiHandler } from "$lib/handlers/chat-handlers";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { FChatTransport } from "$lib/transport/f-chat-transport";
import type { AttachmentFile, ChatMessage, MCPServer } from "$lib/types/chat";
import type { Model } from "$lib/types/model";
import { Chat } from "@ai-sdk/svelte";
import { providerState } from "./provider-state.svelte";

export type { AttachmentFile, ChatMessage, MCPServer } from "$lib/types/chat";
export type { Model } from "$lib/types/model";

export interface Thread {
	id: string;
}

// Updated ChatMessage interface using the standardized Model type
// Chat parameters interface
interface ThreadParmas {
	title: string;
	temperature: number | null;
	topP: number | null;
	frequencyPenalty: number | null;
	presencePenalty: number | null;
	maxTokens: number | null;
	inputValue: string;
	attachments: AttachmentFile[];
	mcpServers: MCPServer[];
	isThinkingActive: boolean;
	isOnlineSearchActive: boolean;
	isMCPActive: boolean;
	selectedModel: Model | null;
	isPrivateChatActive: boolean;
}

export const persistedMessagesState = new PersistedState<ChatMessage[]>(
	"app-chat-messages:" + window.tab.threadId,
	[],
);
export const persistedChatParamsState = new PersistedState<ThreadParmas>(
	"app-thread:" + window.tab.threadId,
	{
		title: "",
		temperature: null,
		topP: null,
		frequencyPenalty: null,
		presencePenalty: null,
		maxTokens: null,
		inputValue: "",
		attachments: [],
		mcpServers: [],
		isThinkingActive: false,
		isOnlineSearchActive: false,
		isMCPActive: false,
		selectedModel: null,
		isPrivateChatActive: false,
	},
);

export const chat = new Chat({
	transport: new FChatTransport<ChatMessage>({
		handler: openaiHandler,
		body: {
			temperature: 0.7,
		},
	}),
	onFinish: ({ messages }) => {
		persistedMessagesState.current = messages;
	},
});

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

	// Get provider name by looking up the provider from the model's providerId
	providerType = $derived<string | null>(
		this.selectedModel
			? (providerState.getProvider(this.selectedModel.providerId)?.name ?? null)
			: null,
	);
	sendMessageEnabled = $derived<boolean>(
		(this.inputValue.trim() !== "" || this.attachments.length > 0) && !!this.selectedModel,
	);
	hasMessages = $derived(this.messages.length > 0);

	sendMessage = () => {
		if (this.sendMessageEnabled) {
			const currentModel = this.selectedModel!;

			chat.sendMessage(
				{ text: this.inputValue },
				{
					body: {
						model: currentModel,
					},
				},
			);

			this.inputValue = "";
			this.attachments = [];
		}
	};

	clearMessages() {
		this.messages = [];
	}

	updateMessage(messageId: string, content: string) {
		this.messages = this.messages.map((msg) => (msg.id === messageId ? { ...msg, content } : msg));
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
