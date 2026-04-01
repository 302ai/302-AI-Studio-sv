import { type } from "arktype";
import { getCodeAgentKy } from "../utils";
import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

export const openclawCronJobResultResponseSchema = type({
	success: "boolean",
	data: type({
		jobId: "string",
		runs: type({
			ts: "number",
			jobId: "string",
			action: "string",
			status: "string",
			error: "string",
			summary: "string?",
			deliveryStatus: "string",
			sessionId: "string?",
			sessionKey: "string?",
			runAtMs: "number",
			durationMs: "number",
			nextRunAtMs: "number?",
			model: "string?",
			provider: "string?",
			usage: type({
				input_tokens: "number",
				output_tokens: "number",
				total_tokens: "number",
			}).optional(),
		}).array(),
	}).array(),
});
export type OpenClawCronJobResultResponse = typeof openclawCronJobResultResponseSchema.infer;

export async function getOpenClawCronJobResult(
	sessionId: string,
): Promise<OpenClawCronJobResultResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const response = await kyInstance
			.get(`302/openclaw/cron/get_runs?session_id=${sessionId}`)
			.json();
		logger.info("[getOpenClawCronJobResult] Cron job result response:", response);
		const validated = openclawCronJobResultResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate cron job result response:", validated.summary);
			throw new Error(`Invalid cron job result response: ${validated.summary}`);
		}
		return validated;
	} catch (error) {
		logger.error("Failed to get openclaw cron job result:", error);
		throw error;
	}
}

export const openClawCronJobRecordSchema = type({
	job_id: "string",
	ts: "number",
});
export const pushOpenClawCronJobRecordRequestSchema = type({
	items: openClawCronJobRecordSchema.array(),
});
export type PushOpenClawCronJobRecordRequest = typeof pushOpenClawCronJobRecordRequestSchema.infer;
export const pushOpenClawCronJobRecordResponseSchema = type({
	success: "boolean",
	inserted: "number",
	skipped: "number",
	total: "number",
});
export type PushOpenClawCronJobRecordResponse =
	typeof pushOpenClawCronJobRecordResponseSchema.infer;

export async function pushOpenClawCronJobRecord(request: PushOpenClawCronJobRecordRequest) {
	try {
		const kyInstance = await getCodeAgentKy();
		const response = await kyInstance
			.post(`302/openclaw/cron/push_runs`, {
				json: request,
			})
			.json();
		logger.info("[pushOpenClawCronJobRecord] Cron job record response:", response);
		const validated = pushOpenClawCronJobRecordResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate cron job record response:", validated.summary);
			throw new Error(`Invalid cron job record response: ${validated.summary}`);
		}
		return validated;
	} catch (error) {
		logger.error("Failed to push openclaw cron job record:", error);
		throw error;
	}
}
