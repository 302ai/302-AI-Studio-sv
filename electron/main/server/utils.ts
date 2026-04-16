import { createLogger } from "@shared/logger";
import type { CodeAgentType } from "@shared/types";
import type { UIMessage } from "ai";
import { batchUploadFile } from "../apis/code-agent";

const logger = createLogger("server");

/**
 * Send an error message through SSE stream and close the controller.
 * This is a helper to avoid repeating error handling code.
 *
 * @param controller - The ReadableStreamDefaultController to send events through
 * @param errorMessage - The error message to display to the user
 */
export function sendStreamError(
	controller: ReadableStreamDefaultController<Uint8Array>,
	errorMessage: string,
): void {
	const encoder = new TextEncoder();
	const errorId = `error-${Date.now()}`;

	controller.enqueue(
		encoder.encode(`data: ${JSON.stringify({ type: "text-start", id: errorId })}\n\n`),
	);
	controller.enqueue(
		encoder.encode(
			`data: ${JSON.stringify({ type: "text-delta", id: errorId, delta: `**Error**: ${errorMessage}` })}\n\n`,
		),
	);
	controller.enqueue(
		encoder.encode(`data: ${JSON.stringify({ type: "text-end", id: errorId })}\n\n`),
	);
	controller.enqueue(
		encoder.encode(`data: ${JSON.stringify({ type: "finish", finishReason: "error" })}\n\n`),
	);
	controller.close();
}

export type OpenAIChatContentPartText = {
	type: "text";
	text: string;
};

export type OpenAIChatContentPartImage = {
	type: "image_url";
	image_url: {
		url: string;
	};
};

/**
 * OpenAI tool call format (for assistant messages).
 */
export type OpenAIToolCall = {
	id: string;
	type: "function";
	function: {
		name: string;
		arguments: string;
	};
};

export type OpenAIChatMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content: string | null | Array<OpenAIChatContentPartText | OpenAIChatContentPartImage>;
	name?: string;
	tool_call_id?: string;
	/** Tool calls for assistant messages */
	tool_calls?: OpenAIToolCall[];
};

type AiSdkIntermediateTextPart = {
	type: "text";
	text: string;
};

type AiSdkIntermediateFilePart = {
	type: "file";
	mediaType?: string;
	filename?: string;
	url?: string;
	data?: string;
};

type AiSdkToolCallPart = {
	type: "tool-call";
	toolCallId: string;
	toolName: string;
	args: unknown;
};

type AiSdkToolResultPart = {
	type: "tool-result";
	toolCallId: string;
	toolName: string;
	output: unknown;
};

type AiSdkIntermediatePart =
	| AiSdkIntermediateTextPart
	| AiSdkIntermediateFilePart
	| AiSdkToolCallPart
	| AiSdkToolResultPart;

type AiSdkIntermediateMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content: string | AiSdkIntermediatePart[];
	name?: string;
	tool_call_id?: string;
};

function coerceToDataUrl(raw: string, mediaType?: string): string {
	if (raw.startsWith("data:")) {
		return raw;
	}

	if (mediaType && /^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/.test(mediaType)) {
		return `data:${mediaType};base64,${raw}`;
	}

	return raw;
}

function describeNonImageFilePart(part: AiSdkIntermediateFilePart): string {
	const name =
		typeof part.filename === "string" && part.filename.trim()
			? part.filename.trim()
			: "(unnamed)";
	const mediaType =
		typeof part.mediaType === "string" && part.mediaType.trim()
			? part.mediaType.trim()
			: "unknown";
	return `[File: ${name}, mediaType: ${mediaType}] (content omitted)`;
}

/**
 * List of model patterns that do not support streaming output.
 * These models (like image generation models) return complete responses instead of SSE streams.
 */
const NON_STREAMING_MODEL_PATTERNS = [
	"-image-", // e.g., gemini-2.5-flash-image-preview
	"-image", // e.g., models ending with -image
	"image-generation", // explicit image generation models
	"dall-e", // OpenAI DALL-E models
	"stable-diffusion", // Stable Diffusion models
];

/**
 * Check if a model supports streaming output.
 * Image generation models and some other special models don't support streaming.
 */
export function isStreamingSupported(modelId: string): boolean {
	const lowerModelId = modelId.toLowerCase();
	return !NON_STREAMING_MODEL_PATTERNS.some((pattern) => lowerModelId.includes(pattern));
}

/**
 * Convert a non-streaming response to UI message stream format (SSE).
 * This is used for models that don't support streaming (like image generation models).
 *
 * This function creates a stream that:
 * 1. Immediately sends a "start" event for optimistic UI update
 * 2. Executes the async content generator
 * 3. Streams the content and finish events
 *
 * @param contentGenerator - An async function that returns the text content
 * @param model - The model ID
 * @param provider - The provider name
 * @returns A ReadableStream that emits SSE events compatible with toUIMessageStream
 */
export function createUIMessageStreamFromGenerator(
	contentGenerator: () => Promise<string>,
	model: string,
	provider: string,
): ReadableStream<Uint8Array> {
	const encoder = new TextEncoder();

	return new ReadableStream({
		async start(controller) {
			const messageMetadata = {
				model,
				provider,
				createdAt: new Date().toISOString(),
			};

			// 1. Send start event immediately for optimistic UI update
			controller.enqueue(
				encoder.encode(
					`data: ${JSON.stringify({
						type: "start",
						messageMetadata,
					})}\n\n`,
				),
			);
			logger.info(
				`[createUIMessageStreamFromGenerator] Sent immediate start event for model ${model}`,
			);

			try {
				// 2. Execute the async content generator
				const content = await contentGenerator();

				// 3. Generate a unique ID for this text part
				const textId = `text-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

				// 4. Send start-step event (NO messageMetadata)
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "start-step",
						})}\n\n`,
					),
				);

				// 5. Send text-start event
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "text-start",
							id: textId,
						})}\n\n`,
					),
				);

				// 6. Send text-delta event with the full content
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "text-delta",
							id: textId,
							delta: content,
						})}\n\n`,
					),
				);

				// 7. Send text-end event
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "text-end",
							id: textId,
						})}\n\n`,
					),
				);

				// 8. Send finish-step event (NO messageMetadata)
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "finish-step",
						})}\n\n`,
					),
				);

				// 9. Send message-metadata event
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "message-metadata",
							messageMetadata,
						})}\n\n`,
					),
				);

				// 10. Send finish event (with messageMetadata)
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							type: "finish",
							finishReason: "stop",
							messageMetadata,
						})}\n\n`,
					),
				);

				// 11. Send [DONE] marker
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));

				controller.close();
			} catch (error) {
				logger.error(
					`[createUIMessageStreamFromGenerator] Error for model ${model}:`,
					error,
				);

				// Send error as text-delta so user sees it
				const errorId = `error-${Date.now()}`;
				const errorMessage = error instanceof Error ? error.message : "Unknown error";

				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: "start-step" })}\n\n`),
				);
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ type: "text-start", id: errorId })}\n\n`,
					),
				);
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ type: "text-delta", id: errorId, delta: `**Error**: ${errorMessage}` })}\n\n`,
					),
				);
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ type: "text-end", id: errorId })}\n\n`,
					),
				);
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ type: "finish-step" })}\n\n`),
				);
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({ type: "finish", finishReason: "error", messageMetadata })}\n\n`,
					),
				);
				controller.enqueue(encoder.encode("data: [DONE]\n\n"));
				controller.close();
			}
		},
	});
}

/**
 * Convert a non-streaming response to UI message stream format (SSE).
 * This is used for models that don't support streaming (like image generation models).
 *
 * @param content - The text content from the non-streaming response
 * @param model - The model ID
 * @param provider - The provider name
 * @returns A ReadableStream that emits SSE events compatible with toUIMessageStream
 * @deprecated Use createUIMessageStreamFromGenerator for immediate start event support
 */
export function createUIMessageStreamFromText(
	content: string,
	model: string,
	provider: string,
): ReadableStream<Uint8Array> {
	return createUIMessageStreamFromGenerator(() => Promise.resolve(content), model, provider);
}

// Type guards for tool-call and tool-result parts
function isToolCallPart(part: unknown): part is AiSdkToolCallPart {
	return (
		typeof part === "object" &&
		part !== null &&
		(part as AiSdkToolCallPart).type === "tool-call" &&
		typeof (part as AiSdkToolCallPart).toolCallId === "string" &&
		typeof (part as AiSdkToolCallPart).toolName === "string"
	);
}

function isToolResultPart(part: unknown): part is AiSdkToolResultPart {
	return (
		typeof part === "object" &&
		part !== null &&
		(part as AiSdkToolResultPart).type === "tool-result" &&
		typeof (part as AiSdkToolResultPart).toolCallId === "string"
	);
}

function extractToolResultContent(output: unknown): string {
	if (typeof output === "string") {
		return output;
	}
	if (output && typeof output === "object") {
		// Handle { type: "text", value: string } format
		if ("type" in output && output.type === "text" && "value" in output) {
			return String((output as { type: "text"; value: string }).value);
		}
		// Handle { type: "json", value: unknown } format
		if ("type" in output && output.type === "json" && "value" in output) {
			return JSON.stringify((output as { type: "json"; value: unknown }).value);
		}
	}
	return JSON.stringify(output);
}

export function convertAiSdkMessagesToOpenAiMessages(messages: unknown): OpenAIChatMessage[] {
	if (!Array.isArray(messages)) {
		return [];
	}

	return (messages as AiSdkIntermediateMessage[]).flatMap((message): OpenAIChatMessage[] => {
		if (!message || typeof message !== "object") {
			return [];
		}

		const { role, name, tool_call_id } = message;
		const content = (message as AiSdkIntermediateMessage).content;

		// Debug: Log message structure
		logger.debug("[convertAiSdkMessagesToOpenAiMessages] Processing message:", {
			role,
			contentType: typeof content,
			isArray: Array.isArray(content),
			content: Array.isArray(content)
				? content.map((p) => ({ type: (p as { type?: string }).type }))
				: content,
		});

		if (typeof content === "string") {
			const msg: OpenAIChatMessage = {
				role,
				content,
				...(name ? { name } : {}),
				...(tool_call_id ? { tool_call_id } : {}),
			};
			return [msg];
		}

		if (!Array.isArray(content)) {
			const msg: OpenAIChatMessage = {
				role,
				content: "",
				...(name ? { name } : {}),
				...(tool_call_id ? { tool_call_id } : {}),
			};
			return [msg];
		}

		// Check for tool-call parts (assistant message with tool calls)
		const toolCallParts = content.filter((p): p is AiSdkToolCallPart => isToolCallPart(p));
		logger.info(
			"[convertAiSdkMessagesToOpenAiMessages] toolCallParts found:",
			toolCallParts.length,
			"for role:",
			role,
		);
		if (toolCallParts.length > 0 && role === "assistant") {
			const toolCalls: OpenAIToolCall[] = toolCallParts.map((part) => ({
				id: part.toolCallId,
				type: "function" as const,
				function: {
					name: part.toolName,
					arguments:
						typeof part.args === "string" ? part.args : JSON.stringify(part.args),
				},
			}));

			return [
				{
					role: "assistant",
					content: "",
					tool_calls: toolCalls,
				},
			];
		}

		// Check for tool-result parts (tool message with results)
		const toolResultParts = content.filter((p): p is AiSdkToolResultPart =>
			isToolResultPart(p),
		);
		logger.info(
			"[convertAiSdkMessagesToOpenAiMessages] toolResultParts found:",
			toolResultParts.length,
			"for role:",
			role,
		);
		if (toolResultParts.length > 0 && role === "tool") {
			// Each tool result becomes a separate message
			return toolResultParts.map((part) => ({
				role: "tool" as const,
				tool_call_id: part.toolCallId,
				content: extractToolResultContent(part.output),
			}));
		}

		const parts: Array<OpenAIChatContentPartText | OpenAIChatContentPartImage> = [];
		const nonImageFileDescriptions: string[] = [];

		for (const part of content) {
			if (!part || typeof part !== "object") {
				continue;
			}

			if ((part as AiSdkIntermediateTextPart).type === "text") {
				const text = (part as AiSdkIntermediateTextPart).text;
				parts.push({ type: "text", text: typeof text === "string" ? text : "" });
				continue;
			}

			if ((part as AiSdkIntermediateFilePart).type === "file") {
				const filePart = part as AiSdkIntermediateFilePart;
				const mediaType =
					typeof filePart.mediaType === "string" ? filePart.mediaType : undefined;
				const raw =
					typeof filePart.url === "string"
						? filePart.url
						: typeof filePart.data === "string"
							? filePart.data
							: undefined;

				if (!raw) {
					nonImageFileDescriptions.push(describeNonImageFilePart(filePart));
					continue;
				}

				const isImage = mediaType?.startsWith("image/");
				const isZip =
					mediaType?.includes("zip") || filePart.filename?.toLowerCase().endsWith(".zip");

				if (isImage || isZip) {
					parts.push({
						type: "image_url",
						image_url: {
							url: coerceToDataUrl(raw, mediaType),
						},
					});
				} else {
					nonImageFileDescriptions.push(describeNonImageFilePart(filePart));
				}
			}
		}

		if (nonImageFileDescriptions.length > 0) {
			parts.unshift({
				type: "text",
				text: nonImageFileDescriptions.join("\n"),
			});
		}

		const msg: OpenAIChatMessage = {
			role,
			content: parts,
			...(name ? { name } : {}),
			...(tool_call_id ? { tool_call_id } : {}),
		};
		return [msg];
	});
}

/*
/**
 * Skill type for forced skill injection.
 */
export type SkillForInjection = {
	name: string;
	isBuiltin?: boolean;
	content?: string;
};

/**
 * AI SDK ModelMessage ToolCallPart format.
 */
export type ToolCallPart = {
	type: "tool-call";
	toolCallId: string;
	toolName: string;
	args: unknown;
};

/**
 * AI SDK ModelMessage ToolResultPart format.
 */
export type ToolResultPart = {
	type: "tool-result";
	toolCallId: string;
	toolName: string;
	output: { type: "text"; value: string };
};

/**
 * AI SDK AssistantModelMessage with tool calls.
 */
export type AssistantModelMessage = {
	role: "assistant";
	content: ToolCallPart[];
};

/**
 * AI SDK ToolModelMessage with tool results.
 */
export type ToolModelMessage = {
	role: "tool";
	content: ToolResultPart[];
};

/**
 * Creates forced skill ModelMessages in AI SDK format (OpenCode style).
 * This creates a pair of messages:
 * 1. An assistant message with tool-call parts
 * 2. A tool message with tool-result parts
 *
 * This simulates the model having already called and received skill content.
 *
 * @param skills Array of skills to inject
 * @param workspacePath Workspace path for project-level skills
 * @returns A tuple of [AssistantModelMessage, ToolModelMessage] or null
 */
export function createForcedSkillModelMessages(
	skills: SkillForInjection[],
	workspacePath: string,
): [AssistantModelMessage, ToolModelMessage] | null {
	if (skills.length === 0) return null;

	const toolCalls: ToolCallPart[] = [];
	const toolResults: ToolResultPart[] = [];

	skills.forEach((skill, index) => {
		const toolCallId = `forced-skill-${skill.name}-${Date.now()}-${index}`;

		// Builtin skills: /home/user/.claude/skills/{skillName}/SKILL.md
		// Project skills: {workspacePath}/.claude/skills/{skillName}/SKILL.md
		const skillPath = skill.isBuiltin
			? `/home/user/.claude/skills/${skill.name}/SKILL.md`
			: `${workspacePath}/.claude/skills/${skill.name}/SKILL.md`;

		const baseDirectory = skillPath.substring(0, skillPath.lastIndexOf("/"));

		// Build skill content
		const fullContent = `## Skill: ${skill.name}\n\n**Base directory**: ${baseDirectory}\n\n${skill.content ?? ""}`;

		// Create tool call (assistant asking for skill)
		toolCalls.push({
			type: "tool-call",
			toolCallId,
			toolName: "skill",
			args: { skillName: skill.name },
		});

		// Create tool result (skill content)
		toolResults.push({
			type: "tool-result",
			toolCallId,
			toolName: "skill",
			output: { type: "text", value: fullContent },
		});
	});

	const assistantMessage: AssistantModelMessage = {
		role: "assistant",
		content: toolCalls,
	};

	const toolMessage: ToolModelMessage = {
		role: "tool",
		content: toolResults,
	};

	return [assistantMessage, toolMessage];
}

/**
 * Placeholder user message to precede the skill tool call.
 * Required because OpenAI API expects conversations to start with user/system, not assistant.
 */
export type PlaceholderUserMessage = {
	role: "user";
	content: [{ type: "text"; text: string }];
};

/**
 * Injects forced skill ModelMessages into the converted messages array.
 * The messages are inserted before the first user message.
 *
 * This approach (inspired by OpenCode) uses fake tool results instead
 * of system prompts, which can be more effective for skill activation.
 *
 * Note: A placeholder user message is added before the assistant message
 * because OpenAI API requires conversations to start with user/system, not assistant.
 *
 * @param messages The list of ModelMessages (mutable array)
 * @param skillMessages The forced skill message pair [assistant, tool]
 */
export function injectForcedSkillModelMessages(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	messages: any[],
	skillMessages: [AssistantModelMessage, ToolModelMessage] | null,
): void {
	if (!skillMessages) return;

	const [assistantMessage, toolMessage] = skillMessages;

	// Create placeholder user message to initiate the skill request
	// This is required because OpenAI API expects conversations to start with user/system
	const placeholderUserMessage: PlaceholderUserMessage = {
		role: "user",
		content: [{ type: "text", text: "Load enabled skills." }],
	};

	// Find the first user message position
	const firstUserIndex = messages.findIndex(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(msg: any) => msg.role === "user",
	);

	if (firstUserIndex === -1) {
		// No user message found, append to the end
		messages.push(placeholderUserMessage, assistantMessage, toolMessage);
	} else {
		// Insert before the first user message
		messages.splice(firstUserIndex, 0, placeholderUserMessage, assistantMessage, toolMessage);
	}
}

/**
 * Prepends a prompt string to the first user message in a list of messages.
 * Handles both string content and array content (multi-modal/parts).
 * Immutably updates the message object in the array.
 *
 * Supported message structures:
 * 1. { role: 'user', parts: [{ type: 'text', text: '...' }] }
 * 2. { role: 'user', content: [{ type: 'text', text: '...' }] }
 * 3. { role: 'user', content: '...' }
 *
 * @param messages The list of messages (mutable array)
 * @param prompt The prompt string to prepend
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prependPromptToFirstUserMessage(messages: any[], prompt: string): void {
	// Find the first user message and prepend the prompt
	for (let i = 0; i < messages.length; i++) {
		if (messages[i].role === "user") {
			const msg = messages[i];

			// Handle 'parts' property (priority, common in newer AI SDK)
			if (Array.isArray(msg.parts)) {
				const newParts = [...msg.parts];
				let firstTextPartIndex = -1;

				// Find the first text part
				for (let j = 0; j < newParts.length; j++) {
					if (newParts[j].type === "text") {
						firstTextPartIndex = j;
						break;
					}
				}

				if (firstTextPartIndex !== -1) {
					// Create a new text part with prepended prompt
					newParts[firstTextPartIndex] = {
						...newParts[firstTextPartIndex],
						text: prompt + newParts[firstTextPartIndex].text,
					};
				} else {
					newParts.unshift({ type: "text", text: prompt });
				}

				messages[i] = {
					...msg,
					parts: newParts,
				};
			}
			// Handle 'content' property (fallback)
			else {
				const content = msg.content;
				let newContent = content;

				if (Array.isArray(content)) {
					newContent = [...content];
					let firstTextPartIndex = -1;

					for (let j = 0; j < newContent.length; j++) {
						if (newContent[j].type === "text") {
							firstTextPartIndex = j;
							break;
						}
					}

					if (firstTextPartIndex !== -1) {
						newContent[firstTextPartIndex] = {
							...newContent[firstTextPartIndex],
							text: prompt + newContent[firstTextPartIndex].text,
						};
					} else {
						newContent.unshift({ type: "text", text: prompt });
					}
				} else if (typeof content === "string") {
					newContent = prompt + content;
				}

				messages[i] = {
					...msg,
					content: newContent,
				};
			}
			break;
		}
	}
}

/**
 * Appends a prompt string to the last user message in a list of messages.
 * Handles both string content and array content (multi-modal/parts).
 * Immutably updates the message object in the array.
 *
 * Supported message structures:
 * 1. { role: 'user', parts: [{ type: 'text', text: '...' }] }
 * 2. { role: 'user', content: [{ type: 'text', text: '...' }] }
 * 3. { role: 'user', content: '...' }
 *
 * @param messages The list of messages (mutable array)
 * @param prompt The prompt string to append
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function appendPromptToLastUserMessage(messages: any[], prompt: string): void {
	const EXCLUDE_PREFIX = ["/commands", "/deploy", "/model", "/max_thinking_token", "/plugin"];

	// Find the last user message and append the prompt
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].role === "user") {
			const msg = messages[i];

			// Check if the message starts with any of the excluded prefixes
			let firstText = "";
			if (typeof msg.content === "string") {
				firstText = msg.content;
			} else if (
				Array.isArray(msg.content) &&
				msg.content.length > 0 &&
				msg.content[0].type === "text"
			) {
				firstText = msg.content[0].text;
			} else if (
				Array.isArray(msg.parts) &&
				msg.parts.length > 0 &&
				msg.parts[0].type === "text"
			) {
				firstText = msg.parts[0].text;
			}

			if (EXCLUDE_PREFIX.some((prefix) => firstText.startsWith(prefix))) {
				break;
			}

			// Handle 'parts' property (priority, common in newer AI SDK)
			if (Array.isArray(msg.parts)) {
				const newParts = [...msg.parts];
				let lastTextPartIndex = -1;

				// Find the last text part
				for (let j = newParts.length - 1; j >= 0; j--) {
					if (newParts[j].type === "text") {
						lastTextPartIndex = j;
						break;
					}
				}

				if (lastTextPartIndex !== -1) {
					// Create a new text part with appended prompt
					newParts[lastTextPartIndex] = {
						...newParts[lastTextPartIndex],
						text: newParts[lastTextPartIndex].text + prompt,
					};
				} else {
					newParts.push({ type: "text", text: prompt });
				}

				messages[i] = {
					...msg,
					parts: newParts,
				};
			}
			// Handle 'content' property (fallback)
			else {
				const content = msg.content;
				let newContent = content;

				if (Array.isArray(content)) {
					newContent = [...content];
					let lastTextPartIndex = -1;

					for (let j = newContent.length - 1; j >= 0; j--) {
						if (newContent[j].type === "text") {
							lastTextPartIndex = j;
							break;
						}
					}

					if (lastTextPartIndex !== -1) {
						newContent[lastTextPartIndex] = {
							...newContent[lastTextPartIndex],
							text: newContent[lastTextPartIndex].text + prompt,
						};
					} else {
						newContent.push({ type: "text", text: prompt });
					}
				} else if (typeof content === "string") {
					newContent = content + prompt;
				}

				messages[i] = {
					...msg,
					content: newContent,
				};
			}
			break;
		}
	}
}

/**
 * Prepends or appends a prompt string to system message in a list of messages.
 * If no system message exists, creates one. If system message exists, appends to it.
 *
 * @param messages The list of messages (mutable array)
 * @param prompt The prompt string to prepend or append
 * @param prepend Whether to prepend (before existing content) or append (after). Default is append.
 */

export function appendPromptToSystemMessage(
	messages: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
	prompt: string,
	prepend = false,
): void {
	// Find existing system message
	const existingSystemIndex = messages.findIndex((msg) => msg.role === "system");

	if (existingSystemIndex !== -1) {
		// System message exists, append or prepend to it
		const msg = messages[existingSystemIndex];
		const parts = msg.parts;
		const content = msg.content;

		// Handle parts array (UIMessage structure)
		if (Array.isArray(parts)) {
			const newParts = [...parts];
			if (prepend) {
				newParts.unshift({ type: "text", text: prompt });
			} else {
				newParts.push({ type: "text", text: prompt });
			}
			messages[existingSystemIndex] = {
				...msg,
				parts: newParts,
			};
		}
		// Handle content array
		else if (Array.isArray(content)) {
			const newContent = [...content];
			if (prepend) {
				newContent.unshift({ type: "text", text: prompt });
			} else {
				newContent.push({ type: "text", text: prompt });
			}
			messages[existingSystemIndex] = {
				...msg,
				content: newContent,
			};
		}
		// Handle content string
		else if (typeof content === "string") {
			messages[existingSystemIndex] = {
				...msg,
				content: prepend ? prompt + content : content + prompt,
			};
		}
	} else {
		// No system message, create one at the beginning with parts structure
		messages.unshift({
			role: "system",
			content: prompt,
			parts: [{ type: "text", text: prompt }],
		});
	}
}

/**
 * Upload attachments from message metadata to sandbox before sending to AI provider.
 * This enables non-blocking UX where users see immediate stream response.
 *
 * @param sandboxId - The sandbox ID to upload to
 * @param workspacePath - The workspace path in the sandbox
 * @param messages - The messages array containing attachment metadata
 * @returns Promise that resolves when upload completes (or fails gracefully)
 */
export async function uploadAttachmentsFromMessages(
	sandboxId: string,
	workspacePath: string,
	mode: CodeAgentType,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	messages: any[],
): Promise<void> {
	if (!workspacePath || messages.length === 0) {
		return;
	}

	const lastUserMessage = [...messages].reverse().find((msg) => msg.role === "user");
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const metadata = lastUserMessage?.metadata as any;
	if (!metadata?.attachments) {
		return;
	}

	const attachments = metadata.attachments as Array<{
		id: string;
		name: string;
		type: string;
		size: number;
		preview?: string;
		filePath?: string;
	}>;

	if (attachments.length === 0) {
		return;
	}

	logger.debug(`[uploadAttachmentsFromMessages] Uploading ${attachments.length} attachments`);

	try {
		const fileList = await Promise.all(
			attachments.map(async (att) => {
				let base64Content: string | null = null;

				// Priority 1: Use preview if it's already base64
				if (att.preview && att.preview.startsWith("data:")) {
					base64Content = att.preview;
				}

				if (!base64Content) {
					logger.warn(
						`[uploadAttachmentsFromMessages] Attachment ${att.name} has no preview or filePath`,
					);
					return null;
				}

				return {
					content: base64Content,
					save_path: `${workspacePath}/.302ai/attachments/${att.name}`,
				};
			}),
		);

		// Filter out null entries (failed reads)
		const validFiles = fileList.filter((f) => f !== null) as Array<{
			content: string;
			save_path: string;
		}>;

		if (validFiles.length > 0) {
			const uploadResponse = await batchUploadFile(
				{
					sandbox_id: sandboxId,
					file_list: validFiles,
				},
				mode,
			);

			const failedUploads = uploadResponse.result.filter((r) => !r.success);
			if (!uploadResponse.success || failedUploads.length > 0) {
				logger.error(
					"[uploadAttachmentsFromMessages] Some attachments failed to upload:",
					failedUploads.map((r) => r.error).join(", "),
				);
				// Continue anyway - partial upload is better than blocking
			} else {
				logger.info(
					`[uploadAttachmentsFromMessages] Successfully uploaded ${validFiles.length} attachments`,
				);
			}
		}
	} catch (error) {
		logger.error("[uploadAttachmentsFromMessages] Failed to upload attachments:", error);
		// Continue anyway - don't block message sending
	}
}

/**
 * Apply context compression to messages and system prompt.
 *
 * When compression is active, this function:
 * 1. Slices off the oldest `compressedMessageCount` messages, keeping only recent ones
 * 2. Prepends the context summary to the system prompt with marker tags
 *
 * This must be called AFTER user prompt template resolution (which needs full history)
 * and BEFORE convertToModelMessages (which should receive filtered messages).
 *
 * @param messages - The full list of UI messages
 * @param systemPrompt - The current system prompt (may be undefined)
 * @param contextSummary - The compressed context summary text
 * @param compressedMessageCount - Number of oldest messages that have been compressed
 * @returns Object with filtered messages and augmented system prompt
 */
export function applyContextCompression(
	messages: UIMessage[],
	systemPrompt: string | undefined,
	contextSummary: string,
	compressedMessageCount: number,
): { messages: UIMessage[]; systemPrompt: string } {
	const recentMessages =
		compressedMessageCount > 0 && compressedMessageCount < messages.length
			? messages.slice(compressedMessageCount)
			: messages;

	const summaryBlock = `[Context from earlier conversation]\n${contextSummary}\n[End of earlier context]`;
	const augmentedSystemPrompt = systemPrompt
		? `${summaryBlock}\n\n${systemPrompt}`
		: summaryBlock;

	return { messages: recentMessages, systemPrompt: augmentedSystemPrompt };
}
