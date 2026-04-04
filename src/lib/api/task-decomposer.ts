import type { ModelProvider } from "@shared/storage/provider";
import type { Model } from "@shared/types";
import ky from "ky";
import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

export interface DecomposeTaskRequest {
	requirement: string;
	count: number;
	model: string;
	apiKey?: string;
	baseUrl?: string;
	providerType: "302ai" | "openai" | "anthropic" | "gemini";
}

export interface DecomposeTaskResponse {
	tasks: Array<{
		id: string;
		content: string;
		acceptance_criteria?: string;
		dependencies?: string[];
	}>;
}

export async function decomposeTasks(
	requirement: string,
	count: number,
	model: Model,
	provider: ModelProvider | undefined,
	serverPort?: number,
	abortSignal?: AbortSignal,
): Promise<string[]> {
	const port = serverPort ?? 8089;

	logger.debug("[TaskDecomposer] Starting task decomposition with model:", model.id);

	try {
		const data: DecomposeTaskResponse = await ky
			.post(`http://localhost:${port}/decompose-tasks`, {
				json: {
					requirement,
					count,
					model: model.id,
					apiKey: provider?.apiKey,
					baseUrl: provider?.baseUrl,
					providerType: provider?.apiType || "openai",
				} satisfies DecomposeTaskRequest,
				signal: abortSignal,
				timeout: 300000,
				retry: 3,
			})
			.json();

		logger.debug("[TaskDecomposer] Received response:", data);

		if (!data.tasks || !Array.isArray(data.tasks)) {
			logger.error("[TaskDecomposer] Invalid response format:", data);
			return [];
		}

		// Extract task contents
		const taskContents = data.tasks.map((task) => task.content);
		logger.info("[TaskDecomposer] Decomposed tasks:", taskContents);

		return taskContents;
	} catch (error) {
		logger.error("[TaskDecomposer] Error during task decomposition:", error);
		throw error;
	}
}
