import type { ChatVariable } from "@shared/storage/chat-parameters";
import type { ChatMessage } from "@shared/types";
import { resolvePrompt } from "@shared/utils/chat-parameters";
import { chatMessagesService } from "../chat-messages-service";
import { chatParametersStorage } from "../storage-service/chat-parameters-storage";

const DETECTOR_VARIABLE = "input";

class ChatParametersService {
	async removeChatParameters(threadId: string): Promise<void> {
		await chatParametersStorage.removeChatParameters(threadId);
	}

	async validateUserPromptTemplateVariables(threadId: string): Promise<boolean> {
		const variables = await chatParametersStorage.getUserPromptTemplateVariables(threadId);
		if (variables.length === 0) return false;

		return variables.includes(DETECTOR_VARIABLE);
	}

	async resolvePrevUserMsgsByUserPromptTemp(
		threadId: string,
		modelId: string,
		excludeLastUserMessageId?: string,
	): Promise<ChatMessage[]> {
		const previousMessages = await chatMessagesService.getMessagesByThreadId(threadId);

		console.log(
			"Resolving user prompt template variables for thread - before:",
			JSON.stringify(previousMessages, null, 2),
		);

		// Find the last user message index
		let messagesToTruncate = previousMessages;

		if (excludeLastUserMessageId) {
			const targetIndex = previousMessages.findIndex(
				(msg) => msg.id === excludeLastUserMessageId,
			);
			if (targetIndex !== -1) {
				// If target message exists in storage (e.g. regeneration), truncate everything after it
				messagesToTruncate = previousMessages.slice(0, targetIndex + 1);
				console.log(
					"Truncated messages to target user message at index",
					targetIndex,
					"new length:",
					messagesToTruncate.length,
				);
			}
		} else {
			const lastUserMessageIndex = previousMessages.reduceRight((acc, msg, index) => {
				return acc === -1 && msg.role === "user" ? index : acc;
			}, -1);

			// If user message is not the last message, truncate to include only messages up to and including the last user message
			if (lastUserMessageIndex !== -1 && lastUserMessageIndex < previousMessages.length - 1) {
				messagesToTruncate = previousMessages.slice(0, lastUserMessageIndex + 1);
				console.log(
					"Truncated messages to last user message at index",
					lastUserMessageIndex,
					"new length:",
					messagesToTruncate.length,
				);
			}
		}

		// Filter out the message to exclude (for regenerate case) before processing
		const messagesToProcess = excludeLastUserMessageId
			? messagesToTruncate.filter((msg) => msg.id !== excludeLastUserMessageId)
			: messagesToTruncate;

		const resolvedMessages = messagesToProcess.map((message) => {
			if (message.role !== "user") return message;
			if (!message.metadata) return message;
			const {
				userPromptTemplateVariables,
				userPromptTemplateContent,
				userPromptTemplateMap,
			} = message.metadata;
			if (
				!userPromptTemplateVariables ||
				!userPromptTemplateContent ||
				!userPromptTemplateMap
			)
				return message;
			const needResolve = userPromptTemplateVariables.includes(DETECTOR_VARIABLE);
			if (!needResolve) return message;

			const candidateTextPart = message.parts.filter((part) => part.type === "text").at(-1);
			if (!candidateTextPart) return message;

			// Get template and variables from metadata
			const templateContent = userPromptTemplateContent;
			const variables = userPromptTemplateVariables as ChatVariable[];
			const cachedMap = userPromptTemplateMap;

			// Resolve variables in template
			const { content: resolvedText } = resolvePrompt(templateContent, {
				input: candidateTextPart.text,
				modelId,
				cachedMap,
				variables,
			});

			// Create new message with resolved text
			const resolvedParts = [
				...message.parts.slice(0, -1),
				{ type: "text" as const, text: resolvedText },
			];

			return {
				...message,
				parts: resolvedParts,
			};
		});

		return resolvedMessages;
	}

	async resolveLastUserTextByUserPromptTemp(
		threadId: string,
		lastMessage: ChatMessage,
		modelId: string,
	): Promise<ChatMessage> {
		// Get user prompt template from storage
		const { variables, content } = await chatParametersStorage.getUserPromptTemplate(threadId);

		// Check if template contains input variable
		if (!variables.includes(DETECTOR_VARIABLE)) {
			return lastMessage;
		}

		const candidateTextPart = lastMessage.parts.filter((part) => part.type === "text").at(-1);
		if (!candidateTextPart) {
			return lastMessage;
		}

		// Get the current input value
		const inputValue = candidateTextPart.text;

		// Override cached map input with current input to avoid using stale value
		const currentMap = { input: inputValue };

		// Resolve variables in template
		const { content: resolvedText, updatedMap } = resolvePrompt(content, {
			input: inputValue,
			modelId,
			cachedMap: currentMap,
			variables: variables as ChatVariable[],
		});

		await chatParametersStorage.updateUserPromptTemplateMap(threadId, {
			...updatedMap,
			input: inputValue, // Always update input to current value
		});

		// Create new message with resolved text
		const resolvedParts = [
			...lastMessage.parts.slice(0, -1),
			{ type: "text" as const, text: resolvedText },
		];

		return {
			...lastMessage,
			parts: resolvedParts,
		};
	}
}

export const chatParametersService = new ChatParametersService();
