export const MODEL_LIST_CONFIGS = {
	anthropic: {
		functionCall: ["claude"],
		reasoning: ["thinking", "-3-7", "3.7", "-4"],
		vision: ["claude"],
	},
	deepseek: {
		functionCall: ["v3", "r1", "deepseek-chat"],
		reasoning: ["r1", "deepseek-reasoner", "v3.1", "v3.2"],
		vision: [],
	},
	google: {
		functionCall: ["gemini", "!-image-"],
		reasoning: ["thinking", "-2.5-", "!-image-"],
		vision: ["gemini", "learnlm"],
	},
	llama: {
		functionCall: ["llama-3.2", "llama-3.3", "llama-4"],
		reasoning: [],
		vision: ["llava"],
	},
	openai: {
		functionCall: ["4o", "4.1", "o3", "o4", "oss"],
		reasoning: ["o1", "o3", "o4", "oss"],
		vision: ["4o", "4.1", "o4"],
	},
	qwen: {
		functionCall: [
			"qwen-max",
			"qwen-plus",
			"qwen-turbo",
			"qwen-long",
			"qwen1.5",
			"qwen2",
			"qwen2.5",
			"qwen3",
		],
		reasoning: ["qvq", "qwq", "qwen3", "!-instruct-", "!-coder-", "!-max-"],
		vision: ["qvq", "vl"],
	},
	v0: {
		functionCall: ["v0"],
		reasoning: ["v0-1.5"],
		vision: ["v0"],
	},
	volcengine: {
		functionCall: ["1.5", "1-5", "1.6", "1-6"],
		reasoning: ["thinking", "seed", "ui-tars"],
		vision: ["vision", "-m", "seed", "ui-tars"],
	},
	zeroone: {
		functionCall: ["fc"],
		reasoning: [],
		vision: ["vision"],
	},
	zhipu: {
		functionCall: ["glm-4", "glm-z1"],
		reasoning: ["glm-zero", "glm-z1", "glm-4.5"],
		vision: ["glm-4v", "glm-4.1v", "glm-4.5v"],
	},
} as const;

export const PROVIDER_DETECTION_CONFIG = {
	anthropic: ["claude"],
	deepseek: ["deepseek"],
	google: ["gemini"],
	llama: ["llama"],
	openai: ["o1", "o3", "o4", "gpt-"],
	qwen: ["qwen", "qwq", "qvq"],
	v0: ["v0"],
	volcengine: ["doubao"],
	zeroone: ["yi-"],
	zhipu: ["glm"],
} as const;

export const detectModelProvider = (modelId: string): keyof typeof MODEL_LIST_CONFIGS => {
	const lowerModelId = modelId.toLowerCase();

	for (const [provider, keywords] of Object.entries(PROVIDER_DETECTION_CONFIG)) {
		const hasKeyword = keywords.some((keyword) => lowerModelId.includes(keyword));

		if (hasKeyword && provider in MODEL_LIST_CONFIGS) {
			return provider as keyof typeof MODEL_LIST_CONFIGS;
		}
	}

	return "openai";
};

export function parseModelCapabilities(
	modelId: string,
	keywords: string[] = ["functionCall", "reasoning", "vision"],
): Set<string> {
	const provider = detectModelProvider(modelId);
	const config = MODEL_LIST_CONFIGS[provider];
	const capabilities = new Set<string>();
	const lowerModelId = modelId.toLowerCase();

	for (const keywordType of keywords) {
		switch (keywordType) {
			case "functionCall":
				if (config.functionCall?.some((keyword) => lowerModelId.includes(keyword.toLowerCase()))) {
					capabilities.add("function_call");
				}
				break;

			case "reasoning":
				if (config.reasoning?.some((keyword) => lowerModelId.includes(keyword.toLowerCase()))) {
					capabilities.add("reasoning");
				}
				break;

			case "vision":
				if (config.vision?.some((keyword) => lowerModelId.includes(keyword.toLowerCase()))) {
					capabilities.add("vision");
				}
				break;
		}
	}

	return capabilities;
}
