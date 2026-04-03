import { getOpenClawCronJobResult, type OpenClawCronJobResultResponse } from "./base-apis";
import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

let currentPollInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start listening for OpenClaw cron job results for a specific session.
 * Polling happens every 30 seconds. Only one polling task can exist per Tab process.
 *
 * @param sessionId - The session ID to poll for
 * @param onResult - Callback function to handle the fetched result
 */
export async function startListeningOpenClawCronJobs(
	sessionId: string,
	onResult: (result: OpenClawCronJobResultResponse["data"][number]["runs"]) => void,
) {
	// Ensure only one interval exists in this Tab process
	if (currentPollInterval) return;

	const fetchResult = async () => {
		try {
			const response = await getOpenClawCronJobResult(sessionId);
			if (response.success) {
				logger.info("[CronPoll] Fetched result for session:", sessionId);
				const allRuns = response.data.flatMap((d) => d.runs);
				onResult(allRuns);
			} else {
				logger.error("[CronPoll] Failed to fetch result:", response);
			}
		} catch (error) {
			logger.error("[CronPoll] Failed to fetch result:", error);
		}
	};

	// Execute immediately on start
	await fetchResult();

	// Schedule every 30 seconds
	currentPollInterval = setInterval(fetchResult, 30 * 1000);
}

/**
 * Stop any active cron job result listening in the current Tab process.
 */
export function stopListeningOpenClawCronJobs() {
	if (currentPollInterval) {
		clearInterval(currentPollInterval);
		currentPollInterval = null;
		logger.info("[CronPoll] Polling stopped for current tab.");
	}
}
