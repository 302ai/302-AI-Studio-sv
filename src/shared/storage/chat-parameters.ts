import { type } from "arktype";

export const ChatVariable = type("'input' | 'date' | 'time' | 'datetime' | 'now' | 'model_id'");
export type ChatVariable = typeof ChatVariable.infer;

export const SystemPromptPresetType = type(
	"'universal-type' | 'terse-and-effective-type' | 'deep-thinking-type'",
);
export type SystemPromptPresetType = typeof SystemPromptPresetType.infer;

export const CustomPreset = type({
	key: "string",
	name: "string",
	rawJson: "string.json",
});
export type CustomPreset = typeof CustomPreset.infer;

export const ChatParameters = type({
	// System Prompt
	systemPromptVariables: ChatVariable.array(),
	systemPromptMap: type({ "[string]": "string" }),
	systemPromptContent: "string",
	systemPromptPresetType: "string",
	systemPromptRawJson: "string.json",
	// User Prompt Template
	userPromptTemplateVariables: ChatVariable.array(),
	userPromptTemplateMap: type({ "[string]": "string" }),
	userPromptTemplateContent: "string",
	userPromptTemplateRawJson: "string.json",
});
export type ChatParameters = typeof ChatParameters.infer;
