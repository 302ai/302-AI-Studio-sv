import type { ModelProvider } from "@shared/storage/provider";
import type { Model } from "@shared/types";
import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

export interface FallbackModelConfig {
	model: Model;
	provider: ModelProvider | undefined;
}

// Keep in sync across all generation features (title/suggestions/context summary)
export const DEFAULT_FALLBACK_MODEL_ID = "gpt-4o-mini";
export const DEFAULT_FALLBACK_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withGenerationFallback<T>(args: {
	operation: string;
	model: Model;
	provider: ModelProvider | undefined;
	fallbackConfig?: FallbackModelConfig;
	signal?: AbortSignal;
	request: (modelId: string, provider: ModelProvider | undefined) => Promise<T>;
}): Promise<T | null> {
	const { operation, model, provider, fallbackConfig, signal, request } = args;

	try {
		// First attempt with configured model
		return await request(model.id, provider);
	} catch (error) {
		// Aborts should never trigger fallback.
		if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
		logger.error(`${operation} failed with configured model:`, error);

		logger.info(`Retrying ${operation} after ${DEFAULT_FALLBACK_RETRY_DELAY_MS}ms...`);
		await sleep(DEFAULT_FALLBACK_RETRY_DELAY_MS);
		if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

		// Determine fallback model/provider
		let fallbackModelId: string;
		let fallbackProvider: ModelProvider | undefined;

		if (fallbackConfig) {
			// Use provided fallback config (typically current chat model)
			fallbackModelId = fallbackConfig.model.id;
			fallbackProvider = fallbackConfig.provider;
			logger.info(`Using chat model as fallback: ${fallbackModelId}`);
		} else {
			// Use hardcoded default fallback model
			fallbackModelId = DEFAULT_FALLBACK_MODEL_ID;
			fallbackProvider = provider;
			logger.info(`Using default fallback model: ${fallbackModelId}`);
		}

		// If fallback is identical to the original, give up.
		if (fallbackModelId === model.id && fallbackProvider?.id === provider?.id) {
			logger.error("Fallback model is same as original, giving up");
			return null;
		}

		try {
			return await request(fallbackModelId, fallbackProvider);
		} catch (fallbackError) {
			logger.error(`${operation} failed with fallback model:`, fallbackError);
			return null;
		}
	}
}
