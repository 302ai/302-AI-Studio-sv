import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

/**
 * Retry utility with exponential backoff
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param delay - Initial delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay in milliseconds (default: 10000)
 * @returns Promise that resolves with the function result
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	delay = 1000,
	maxDelay = 10000,
): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (attempt < maxRetries - 1) {
				const waitTime = Math.min(delay * Math.pow(2, attempt), maxDelay);
				logger.warn(
					`Retry attempt ${attempt + 1}/${maxRetries} failed, retrying in ${waitTime}ms`,
					error,
				);
				await new Promise((resolve) => setTimeout(resolve, waitTime));
			}
		}
	}

	throw lastError;
}
