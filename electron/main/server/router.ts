import type { SearchProvider } from "$lib/stores/preferences-settings.state.svelte";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { serve } from "@hono/node-server";
import type { ModelProvider } from "@shared/storage/provider";
import type { McpServer } from "@shared/types";
import {
	Experimental_Agent as Agent,
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	extractReasoningMiddleware,
	generateText,
	smoothStream,
	stepCountIs,
	streamText,
	wrapLanguageModel,
	type UIMessage,
} from "ai";
import getPort from "get-port";
import { Hono } from "hono";
import { mcpService } from "../services/mcp-service";
import { storageService } from "../services/storage-service";
import { createCitationsFetch } from "./citations-processor";

export type RouterRequestBody = {
	baseUrl?: string;
	model?: string;
	apiKey?: string;
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	isThinkingActive?: boolean;
	isOnlineSearchActive?: boolean;
	isMCPActive?: boolean;
	mcpServerIds?: string[];
	autoParseUrl?: boolean;
	searchProvider?: SearchProvider;
	speedOptions?: {
		enabled: boolean;
		speed: "slow" | "normal" | "fast";
	};
	messages: UIMessage[];
	language?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addDefinedParams(options: any, params: any) {
	if (params.temperature !== undefined && params.temperature !== null) {
		options.temperature = params.temperature;
	}
	if (params.topP !== undefined && params.topP !== null) {
		options.topP = params.topP;
	}
	if (params.maxTokens !== undefined && params.maxTokens !== null) {
		options.maxOutputTokens = params.maxTokens;
	}
	if (params.frequencyPenalty !== undefined && params.frequencyPenalty !== null) {
		options.frequencyPenalty = params.frequencyPenalty;
	}
	if (params.presencePenalty !== undefined && params.presencePenalty !== null) {
		options.presencePenalty = params.presencePenalty;
	}
}

// Generate suggestion prompt based on user's language preference
function getSuggestionsPrompt(language?: string): string {
	if (language === "zh") {
		return '基于我们的对话，建议3个我可能会问的后续问题。只返回一个包含3个字符串的JSON数组，例如：["问题1？", "问题2？", "问题3？"]。不要包含其他文本。';
	}
	// Default to English
	return 'Based on our conversation, suggest 3 follow-up questions I might ask next. Return ONLY a JSON array of 3 strings, like: ["Question 1?", "Question 2?", "Question 3?"]. No other text.';
}

// Add feedback information from metadata to messages
function enhanceMessagesWithFeedback(messages: UIMessage[]) {
	return messages.map((msg) => {
		// Only add feedback for assistant messages that have feedback
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const metadata = msg.metadata as any;
		if (msg.role === "assistant" && metadata?.feedback) {
			const feedbackText =
				metadata.feedback === "like"
					? "[User feedback: 👍 Liked this response]"
					: "[User feedback: 👎 Disliked this response]";

			// Add feedback as a system-like annotation
			return {
				...msg,
				parts: [
					...msg.parts,
					{
						type: "text" as const,
						text: `\n\n${feedbackText}`,
					},
				],
			};
		}
		return msg;
	});
}

function smartChunking(buffer: string): string {
	// whitespace
	const whitespaceMatch = buffer.match(/^\s+/);
	if (whitespaceMatch) {
		return whitespaceMatch[0];
	}

	// Chinese
	const chineseMatch = buffer.match(/^[\u4e00-\u9fff]/);
	if (chineseMatch) {
		return chineseMatch[0];
	}

	// English
	const wordMatch = buffer.match(/^[a-zA-Z]+\d*/);
	if (wordMatch) {
		return wordMatch[0];
	}

	// Numbers
	const numberMatch = buffer.match(/^\d+/);
	if (numberMatch) {
		return numberMatch[0];
	}

	// Punctuation
	return buffer[0];
}

function getDelayForSpeed(speed: "slow" | "normal" | "fast"): number {
	switch (speed) {
		case "slow":
			return 150;
		case "normal":
			return 50;
		case "fast":
			return 20;
		default:
			return 50;
	}
}

const app = new Hono();

app.post("/chat/302ai", async (c) => {
	const {
		baseUrl,
		model = "gpt-4o",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isThinkingActive,
		isOnlineSearchActive,
		isMCPActive,
		mcpServerIds = [],
		autoParseUrl,
		searchProvider = "search1api",
		messages,
		speedOptions,
		language,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;

		isThinkingActive?: boolean;
		isOnlineSearchActive?: boolean;
		isMCPActive?: boolean;
		mcpServerIds?: string[];
		autoParseUrl?: boolean;
		searchProvider?: SearchProvider;

		speedOptions?: {
			enabled: boolean;
			speed: "slow" | "normal" | "fast";
		};

		messages: UIMessage[];
		language?: string;
	}>();
	console.log(
		baseUrl,
		model,
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isThinkingActive,
		isOnlineSearchActive,
		messages,
		speedOptions,
	);

	const openai = createOpenAICompatible({
		name: "302.AI",
		baseURL: baseUrl || "https://api.openai.com/v1",
		apiKey: apiKey || "[REDACTED:sk-secret]",
		fetch: createCitationsFetch(),
	});

	const wrapModel = wrapLanguageModel({
		model: openai.chatModel(model),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "thinking" }),
		],
		providerId: "302.AI",
	});

	const provider302Options: Record<string, boolean | string> = {};

	if (autoParseUrl) {
		provider302Options["file-parse"] = true;
	}

	if (isThinkingActive) {
		provider302Options["r1-fusion"] = true;
	}

	if (isOnlineSearchActive) {
		provider302Options["web-search"] = true;
		provider302Options["search-service"] = searchProvider;
	}

	// Get MCP tools if MCP is active
	let mcpTools = undefined;
	if (isMCPActive && mcpServerIds.length > 0) {
		try {
			const allServers = await storageService.getItemInternal("app-mcp-servers");
			if (allServers) {
				mcpTools = await mcpService.getToolsFromServerIds(mcpServerIds, allServers as McpServer[]);
				console.log(`Loaded ${mcpTools.length} tools from MCP servers`);
			}
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		}
	}

	const streamTextOptions = {
		model: wrapModel,
		messages: convertToModelMessages(enhanceMessagesWithFeedback(messages)),
		providerOptions: {
			"302": provider302Options,
		},
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const streamTextOptionsWithTransform = {
		...streamTextOptions,
		...(speedOptions?.enabled && {
			experimental_transform: smoothStream({
				chunking: smartChunking,
				delayInMs: getDelayForSpeed(speedOptions.speed),
			}),
		}),
	};

	// Wrap in createUIMessageStream to add suggestions after main response
	const stream = createUIMessageStream({
		execute: async ({ writer }) => {
			// Stream the main text response using Agent
			const result = new Agent({
				...streamTextOptionsWithTransform,
				stopWhen: stepCountIs(20),
			}).stream(streamTextOptionsWithTransform);

			writer.merge(
				result.toUIMessageStream({
					messageMetadata: () => ({
						model,
						provider: "ai302",
						createdAt: new Date().toISOString(),
					}),
				}),
			);

			// Wait for the main response to complete
			await result.consumeStream();
			const responseMessages = (await result.response).messages;

			// Generate suggestions based on full conversation
			try {
				console.log("[Suggestions] Starting to generate suggestions...");
				const suggestionTextResult = streamText({
					model: wrapModel,
					messages: [
						...convertToModelMessages(enhanceMessagesWithFeedback(messages)),
						...responseMessages,
						{
							role: "user",
							content: getSuggestionsPrompt(language),
						},
					],
				});

				// Collect the full text response
				let fullText = "";
				for await (const chunk of suggestionTextResult.textStream) {
					fullText += chunk;
				}
				console.log("[Suggestions] Received text:", fullText);

				// Parse the JSON array
				try {
					// Clean up the text - remove markdown code blocks if present
					let cleanText = fullText.trim();
					if (cleanText.startsWith("```")) {
						cleanText = cleanText
							.replace(/```json?\n?/g, "")
							.replace(/```/g, "")
							.trim();
					}

					const suggestions = JSON.parse(cleanText);
					if (Array.isArray(suggestions) && suggestions.length > 0) {
						console.log("[Suggestions] Parsed suggestions:", suggestions);
						writer.write({
							type: "data-suggestions",
							data: {
								suggestions: suggestions.slice(0, 3),
							},
						});
					}
				} catch (parseError) {
					console.error("[Suggestions] Failed to parse JSON:", parseError);
				}

				console.log("[Suggestions] Completed");
			} catch (error) {
				console.error("[Suggestions] Failed to generate suggestions:", error);
				// Continue without suggestions
			}
		},
	});

	return createUIMessageStreamResponse({ stream });
});

app.post("/chat/openai", async (c) => {
	const {
		baseUrl,
		model = "gpt-4o",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isMCPActive,
		mcpServerIds = [],
		messages,
		speedOptions,
		language,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		isMCPActive?: boolean;
		mcpServerIds?: string[];
		speedOptions?: {
			enabled: boolean;
			speed: "slow" | "normal" | "fast";
		};
		messages: UIMessage[];
		language?: string;
	}>();

	const openai = createOpenAI({
		baseURL: baseUrl || "https://api.openai.com/v1",
		apiKey: apiKey || "[REDACTED:sk-secret]",
	});

	const wrapModel = wrapLanguageModel({
		model: openai.chat(model),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "thinking" }),
		],
	});

	// Get MCP tools if MCP is active
	let mcpTools = undefined;
	if (isMCPActive && mcpServerIds.length > 0) {
		try {
			const allServers = await storageService.getItemInternal("app-mcp-servers");
			if (allServers) {
				mcpTools = await mcpService.getToolsFromServerIds(mcpServerIds, allServers as McpServer[]);
				console.log(`Loaded ${mcpTools.length} tools from MCP servers`);
			}
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		}
	}

	const streamTextOptions = {
		model: wrapModel,
		messages: convertToModelMessages(enhanceMessagesWithFeedback(messages)),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const streamTextOptionsWithTransform = {
		...streamTextOptions,
		...(speedOptions?.enabled && {
			experimental_transform: smoothStream({
				chunking: smartChunking,
				delayInMs: getDelayForSpeed(speedOptions.speed),
			}),
		}),
	};

	// Wrap in createUIMessageStream to add suggestions after main response
	const stream = createUIMessageStream({
		execute: async ({ writer }) => {
			// Stream the main text response
			const result = streamText(streamTextOptionsWithTransform);

			writer.merge(
				result.toUIMessageStream({
					messageMetadata: () => ({
						model,
						provider: "openai",
						createdAt: new Date().toISOString(),
					}),
				}),
			);

			// Wait for the main response to complete
			await result.consumeStream();
			const responseMessages = (await result.response).messages;

			// Generate suggestions based on full conversation
			try {
				console.log("[Suggestions] Starting to generate suggestions...");
				const suggestionTextResult = streamText({
					model: wrapModel,
					messages: [
						...convertToModelMessages(enhanceMessagesWithFeedback(messages)),
						...responseMessages,
						{
							role: "user",
							content: getSuggestionsPrompt(language),
						},
					],
				});

				// Collect the full text response
				let fullText = "";
				for await (const chunk of suggestionTextResult.textStream) {
					fullText += chunk;
				}
				console.log("[Suggestions] Received text:", fullText);

				// Parse the JSON array
				try {
					// Clean up the text - remove markdown code blocks if present
					let cleanText = fullText.trim();
					if (cleanText.startsWith("```")) {
						cleanText = cleanText
							.replace(/```json?\n?/g, "")
							.replace(/```/g, "")
							.trim();
					}

					const suggestions = JSON.parse(cleanText);
					if (Array.isArray(suggestions) && suggestions.length > 0) {
						console.log("[Suggestions] Parsed suggestions:", suggestions);
						writer.write({
							type: "data-suggestions",
							data: {
								suggestions: suggestions.slice(0, 3),
							},
						});
					}
				} catch (parseError) {
					console.error("[Suggestions] Failed to parse JSON:", parseError);
				}

				console.log("[Suggestions] Completed");
			} catch (error) {
				console.error("[Suggestions] Failed to generate suggestions:", error);
				// Continue without suggestions
			}
		},
	});

	return createUIMessageStreamResponse({ stream });
});

app.post("/chat/anthropic", async (c) => {
	const {
		baseUrl,
		model = "claude-sonnet-4-20250514",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isMCPActive,
		mcpServerIds = [],
		messages,
		speedOptions,
		language,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		isMCPActive?: boolean;
		mcpServerIds?: string[];
		speedOptions?: {
			enabled: boolean;
			speed: "slow" | "normal" | "fast";
		};
		messages: UIMessage[];
		language?: string;
	}>();

	const anthropic = createAnthropic({
		baseURL: baseUrl || "https://api.anthropic.com/v1",
		apiKey: apiKey || "[REDACTED:sk-secret]",
	});

	const wrapModel = wrapLanguageModel({
		model: anthropic.chat(model),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "thinking" }),
		],
	});

	// Get MCP tools if MCP is active
	let mcpTools = undefined;
	if (isMCPActive && mcpServerIds.length > 0) {
		try {
			const allServers = await storageService.getItemInternal("app-mcp-servers");
			if (allServers) {
				mcpTools = await mcpService.getToolsFromServerIds(mcpServerIds, allServers as McpServer[]);
				console.log(`Loaded ${mcpTools.length} tools from MCP servers`);
			}
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		}
	}

	const streamTextOptions = {
		model: wrapModel,
		messages: convertToModelMessages(enhanceMessagesWithFeedback(messages)),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const streamTextOptionsWithTransform = {
		...streamTextOptions,
		...(speedOptions?.enabled && {
			experimental_transform: smoothStream({
				chunking: smartChunking,
				delayInMs: getDelayForSpeed(speedOptions.speed),
			}),
		}),
	};

	// Wrap in createUIMessageStream to add suggestions after main response
	const stream = createUIMessageStream({
		execute: async ({ writer }) => {
			// Stream the main text response
			const result = streamText(streamTextOptionsWithTransform);

			writer.merge(
				result.toUIMessageStream({
					messageMetadata: () => ({
						model,
						provider: "anthropic",
						createdAt: new Date().toISOString(),
					}),
				}),
			);

			// Wait for the main response to complete
			await result.consumeStream();
			const responseMessages = (await result.response).messages;

			// Generate suggestions based on full conversation
			try {
				console.log("[Suggestions] Starting to generate suggestions...");
				const suggestionTextResult = streamText({
					model: wrapModel,
					messages: [
						...convertToModelMessages(enhanceMessagesWithFeedback(messages)),
						...responseMessages,
						{
							role: "user",
							content: getSuggestionsPrompt(language),
						},
					],
				});

				// Collect the full text response
				let fullText = "";
				for await (const chunk of suggestionTextResult.textStream) {
					fullText += chunk;
				}
				console.log("[Suggestions] Received text:", fullText);

				// Parse the JSON array
				try {
					// Clean up the text - remove markdown code blocks if present
					let cleanText = fullText.trim();
					if (cleanText.startsWith("```")) {
						cleanText = cleanText
							.replace(/```json?\n?/g, "")
							.replace(/```/g, "")
							.trim();
					}

					const suggestions = JSON.parse(cleanText);
					if (Array.isArray(suggestions) && suggestions.length > 0) {
						console.log("[Suggestions] Parsed suggestions:", suggestions);
						writer.write({
							type: "data-suggestions",
							data: {
								suggestions: suggestions.slice(0, 3),
							},
						});
					}
				} catch (parseError) {
					console.error("[Suggestions] Failed to parse JSON:", parseError);
				}

				console.log("[Suggestions] Completed");
			} catch (error) {
				console.error("[Suggestions] Failed to generate suggestions:", error);
				// Continue without suggestions
			}
		},
	});

	return createUIMessageStreamResponse({ stream });
});

app.post("/chat/gemini", async (c) => {
	const {
		baseUrl,
		model = "gemini-2.0-flash-exp",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isMCPActive,
		mcpServerIds = [],
		messages,
		speedOptions,
		language,
	} = await c.req.json<{
		baseUrl?: string;
		model?: string;
		apiKey?: string;
		temperature?: number;
		topP?: number;
		maxTokens?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		isMCPActive?: boolean;
		mcpServerIds?: string[];
		speedOptions?: {
			enabled: boolean;
			speed: "slow" | "normal" | "fast";
		};
		messages: UIMessage[];
		language?: string;
	}>();

	const google = createGoogleGenerativeAI({
		baseURL: baseUrl || "https://generativelanguage.googleapis.com/v1beta",
		apiKey: apiKey || "[REDACTED:sk-secret]",
	});

	const wrapModel = wrapLanguageModel({
		model: google.chat(model),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "thinking" }),
		],
	});

	// Get MCP tools if MCP is active
	let mcpTools = undefined;
	if (isMCPActive && mcpServerIds.length > 0) {
		try {
			const allServers = await storageService.getItemInternal("app-mcp-servers");
			if (allServers) {
				mcpTools = await mcpService.getToolsFromServerIds(mcpServerIds, allServers as McpServer[]);
				console.log(`Loaded ${mcpTools.length} tools from MCP servers`);
			}
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		}
	}

	const streamTextOptions = {
		model: wrapModel,
		messages: convertToModelMessages(enhanceMessagesWithFeedback(messages)),
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const streamTextOptionsWithTransform = {
		...streamTextOptions,
		...(speedOptions?.enabled && {
			experimental_transform: smoothStream({
				chunking: smartChunking,
				delayInMs: getDelayForSpeed(speedOptions.speed),
			}),
		}),
	};

	// Wrap in createUIMessageStream to add suggestions after main response
	const stream = createUIMessageStream({
		execute: async ({ writer }) => {
			// Stream the main text response
			const result = streamText(streamTextOptionsWithTransform);

			writer.merge(
				result.toUIMessageStream({
					messageMetadata: () => ({
						model,
						provider: "gemini",
						createdAt: new Date().toISOString(),
					}),
				}),
			);

			// Wait for the main response to complete
			await result.consumeStream();
			const responseMessages = (await result.response).messages;

			// Generate suggestions based on full conversation
			try {
				console.log("[Suggestions] Starting to generate suggestions...");
				const suggestionTextResult = streamText({
					model: wrapModel,
					messages: [
						...convertToModelMessages(enhanceMessagesWithFeedback(messages)),
						...responseMessages,
						{
							role: "user",
							content: getSuggestionsPrompt(language),
						},
					],
				});

				// Collect the full text response
				let fullText = "";
				for await (const chunk of suggestionTextResult.textStream) {
					fullText += chunk;
				}
				console.log("[Suggestions] Received text:", fullText);

				// Parse the JSON array
				try {
					// Clean up the text - remove markdown code blocks if present
					let cleanText = fullText.trim();
					if (cleanText.startsWith("```")) {
						cleanText = cleanText
							.replace(/```json?\n?/g, "")
							.replace(/```/g, "")
							.trim();
					}

					const suggestions = JSON.parse(cleanText);
					if (Array.isArray(suggestions) && suggestions.length > 0) {
						console.log("[Suggestions] Parsed suggestions:", suggestions);
						writer.write({
							type: "data-suggestions",
							data: {
								suggestions: suggestions.slice(0, 3),
							},
						});
					}
				} catch (parseError) {
					console.error("[Suggestions] Failed to parse JSON:", parseError);
				}

				console.log("[Suggestions] Completed");
			} catch (error) {
				console.error("[Suggestions] Failed to generate suggestions:", error);
				// Continue without suggestions
			}
		},
	});

	return createUIMessageStreamResponse({ stream });
});

app.post("/generate-title", async (c) => {
	const { messages, model, apiKey, baseUrl, providerType } = await c.req.json<{
		messages: UIMessage[];
		model: string;
		apiKey?: string;
		baseUrl?: string;
		providerType: ModelProvider["apiType"];
	}>();

	const conversationText = messages
		.map((msg) => {
			const textParts = msg.parts.filter((part) => part.type === "text");
			return textParts.map((part) => ("text" in part ? part.text : "")).join(" ");
		})
		.join("\n");

	let languageModel;
	switch (providerType) {
		case "302ai": {
			const openai = createOpenAICompatible({
				name: "302.AI",
				baseURL: baseUrl || "https://api.openai.com/v1",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = openai.chatModel(model);
			break;
		}
		case "openai": {
			const openai = createOpenAI({
				baseURL: baseUrl || "https://api.openai.com/v1",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = openai.chat(model);
			break;
		}
		case "anthropic": {
			const anthropic = createAnthropic({
				baseURL: baseUrl || "https://api.anthropic.com/v1",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = anthropic.chat(model);
			break;
		}
		case "gemini": {
			const google = createGoogleGenerativeAI({
				baseURL: baseUrl || "https://generativelanguage.googleapis.com/v1beta",
				apiKey: apiKey || "[REDACTED:sk-secret]",
			});
			languageModel = google.chat(model);
			break;
		}
		default:
			return c.json({ error: "Invalid provider type" }, 400);
	}

	try {
		const { text } = await generateText({
			model: languageModel,
			prompt: `Based on the following conversation, generate a concise title (5-10 characters, no punctuation):

${conversationText}

Requirements:
- Accurately summarize the main topic
- Be concise and clear
- Do not use punctuation
- Return only the title text`,
		});

		const title = text.trim();

		return c.json({ title });
	} catch (error) {
		console.error("Title generation error:", error);
		return c.json({ error: "Failed to generate title" }, 500);
	}
});

app.post("/chat/302ai-code-agent", async (c) => {
	const {
		baseUrl,
		model = "gpt-4o",
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isThinkingActive,
		isOnlineSearchActive,
		isMCPActive,
		mcpServerIds = [],
		autoParseUrl,
		searchProvider = "search1api",
		messages,
		speedOptions,
	} = await c.req.json<RouterRequestBody>();
	console.log(
		"Received request for 302ai-code-agent",
		baseUrl,
		model,
		apiKey,
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
		isThinkingActive,
		isOnlineSearchActive,
		messages,
		speedOptions,
	);

	const openai = createOpenAICompatible({
		name: "302.AI",
		baseURL: baseUrl || "https://api.openai.com/v1",
		apiKey: apiKey || "[REDACTED:sk-secret]",
		fetch: createCitationsFetch(),
	});

	const wrapModel = wrapLanguageModel({
		model: openai.chatModel(model),
		middleware: [
			extractReasoningMiddleware({ tagName: "think" }),
			extractReasoningMiddleware({ tagName: "thinking" }),
		],
		providerId: "302.AI",
	});

	const provider302Options: Record<string, boolean | string> = {};

	if (autoParseUrl) {
		provider302Options["file-parse"] = true;
	}

	if (isThinkingActive) {
		provider302Options["r1-fusion"] = true;
	}

	if (isOnlineSearchActive) {
		provider302Options["web-search"] = true;
		provider302Options["search-service"] = searchProvider;
	}

	// Get MCP tools if MCP is active
	let mcpTools = undefined;
	if (isMCPActive && mcpServerIds.length > 0) {
		try {
			const allServers = await storageService.getItemInternal("app-mcp-servers");
			if (allServers) {
				mcpTools = await mcpService.getToolsFromServerIds(mcpServerIds, allServers as McpServer[]);
				console.log(`Loaded ${mcpTools.length} tools from MCP servers`);
			}
		} catch (error) {
			console.error("Failed to load MCP tools:", error);
		}
	}

	const streamTextOptions = {
		model: wrapModel,
		messages: convertToModelMessages(enhanceMessagesWithFeedback(messages)),
		providerOptions: {
			"302": provider302Options,
		},
		...(mcpTools && Object.keys(mcpTools).length > 0 && { tools: mcpTools }),
	};

	addDefinedParams(streamTextOptions, {
		temperature,
		topP,
		maxTokens,
		frequencyPenalty,
		presencePenalty,
	});

	const streamTextOptionsWithTransform = {
		...streamTextOptions,
		...(speedOptions?.enabled && {
			experimental_transform: smoothStream({
				chunking: smartChunking,
				delayInMs: getDelayForSpeed(speedOptions.speed),
			}),
		}),
	};

	// Wrap in createUIMessageStream to add suggestions after main response
	const stream = createUIMessageStream({
		execute: async ({ writer }) => {
			// Stream the main text response using Agent
			const result = new Agent({
				...streamTextOptionsWithTransform,
				stopWhen: stepCountIs(20),
			}).stream(streamTextOptionsWithTransform);

			writer.merge(
				result.toUIMessageStream({
					messageMetadata: () => ({
						model,
						provider: "ai302",
						createdAt: new Date().toISOString(),
					}),
				}),
			);

			// Wait for the main response to complete
			await result.consumeStream();
		},
	});

	return createUIMessageStreamResponse({ stream });
});

export async function initServer(preferredPort = 8089): Promise<number> {
	const port = await getPort({ port: preferredPort });

	serve({
		fetch: app.fetch,
		port,
		hostname: "localhost",
	});

	console.log(`Server started successfully on port ${port}`);
	return port;
}
