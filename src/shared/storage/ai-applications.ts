import { type } from "arktype";

export const AiApplication = type({
	id: "string",
	toolId: "number",
	name: "string",
	description: "string",
	category: "string",
	categoryId: "number",
	collected: "boolean",
	createdAt: "string.date.iso",
});

export type AiApplication = typeof AiApplication.infer;
