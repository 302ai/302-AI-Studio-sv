import type { UIMessage } from "ai";
import { z } from "zod/v4";

export const messageMetadataSchema = z.object({
	createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ChatTools = {};

export type CustomUIDataTypes = {
	[x: string]: unknown;
};

export type ChatMessage = UIMessage<MessageMetadata, CustomUIDataTypes, ChatTools>;
