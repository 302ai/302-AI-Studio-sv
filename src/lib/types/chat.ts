import type { UIMessage } from "ai";
import { z } from "zod/v4";

// Result metadata from 302.AI Claude Code
export const resultMetadataSchema = z.object({
	type: z.string().optional(),
	subtype: z.string().optional(),
	is_error: z.boolean().optional(),
	duration_ms: z.number().optional(),
	duration_api_ms: z.number().optional(),
	num_turns: z.number().optional(),
	content: z.string().optional(),
	session_id: z.string().optional(),
	total_cost_usd: z.number().optional(),
	uuid: z.string().optional(),
	result_files: z.array(z.string()).optional(),
});

export type ResultMetadata = z.infer<typeof resultMetadataSchema>;

export const messageMetadataSchema = z.object({
	createdAt: z.string().optional(),
	model: z.string().optional(),
	attachments: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				type: z.string(),
				size: z.number(),
				filePath: z.string(),
				preview: z.string().optional(),
				textContent: z.string().optional(),
			}),
		)
		.optional(),
	fileContentPartIndex: z.number().optional(),
	feedback: z.enum(["like", "dislike"]).optional(),
	// Result metadata from 302.AI Claude Code
	result: resultMetadataSchema.optional(),
	// User Prompt Template related fields
	userPromptTemplateContent: z.string().optional(),
	userPromptTemplateVariables: z.array(z.string()).optional(),
	userPromptTemplateMap: z.record(z.string(), z.string()).optional(),
	// System Prompt related fields (for assistant messages)
	systemPromptContent: z.string().optional(),
	systemPromptVariables: z.array(z.string()).optional(),
	systemPromptMap: z.record(z.string(), z.string()).optional(),
	// OpenClaw
	isOCCronJobResult: z.boolean().optional(),
	OCCronJobRunData: z.any().optional(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ChatTools = {};

export type CustomUIDataTypes = {
	suggestions?: string[];
	[x: string]: unknown;
};

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>;
