import type { UIMessage } from "ai";
import { z } from "zod/v4";

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
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ChatTools = {};

export type CustomUIDataTypes = {
	suggestions?: string[];
	[x: string]: unknown;
};

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>;
