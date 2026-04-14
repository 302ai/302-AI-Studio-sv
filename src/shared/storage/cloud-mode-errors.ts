import { createLogger } from "@shared/logger";
import { type } from "arktype";

const logger = createLogger("apis");

/**
 * Cloud Mode API Error Codes
 * Reference: Backend API error code specification
 */
export const CloudModeErrorCode = {
	// User info & balance errors (502, 400)
	AI302_GET_USER_INFO_FAILED: "AI302_GET_USER_INFO_FAILED",
	AI302_INSUFFICIENT_BALANCE: "AI302_INSUFFICIENT_BALANCE",
	AI302_CHARGE_FAILED: "AI302_CHARGE_FAILED",

	// Instance creation errors (400, 500)
	APIKEY_INSTANCE_EXISTS: "APIKEY_INSTANCE_EXISTS",
	SWAS_CREATE_INSTANCE_FAILED: "SWAS_CREATE_INSTANCE_FAILED",
	CREATE_INSTANCE_FAILED: "CREATE_INSTANCE_FAILED",

	// Instance operation errors (500, 404, 502)
	SWAS_LIST_INSTANCE_FAILED: "SWAS_LIST_INSTANCE_FAILED",
	SWAS_UPDATE_PASSWORD_FAILED: "SWAS_UPDATE_PASSWORD_FAILED",
	SWAS_REBOOT_FAILED: "SWAS_REBOOT_FAILED",
	INSTANCE_NOT_FOUND: "INSTANCE_NOT_FOUND",
	INSTANCE_UNREACHABLE: "INSTANCE_UNREACHABLE",

	// Instance initialization errors (500)
	INIT_INSTANCE_FAILED: "INIT_INSTANCE_FAILED",

	// Auto-renew errors (500)
	UPDATE_AUTO_RENEW_FAILED: "UPDATE_AUTO_RENEW_FAILED",

	// Manual renew errors (400, 500)
	INSTANCE_RENEW_EXPIRED: "INSTANCE_RENEW_EXPIRED",
	MANUAL_RENEW_FAILED: "MANUAL_RENEW_FAILED",
} as const;

export type CloudModeErrorCode = (typeof CloudModeErrorCode)[keyof typeof CloudModeErrorCode];

/**
 * Cloud Mode API Error Response Schema
 * Structure: { success: false, error: { message: string, code: string } }
 */
export const cloudModeErrorResponseSchema = type({
	success: "false",
	error: {
		message: "string",
		code: "string",
	},
});

export type CloudModeErrorResponse = typeof cloudModeErrorResponseSchema.infer;

/**
 * Custom error class for Cloud Mode API errors
 * Provides structured error information with error codes and HTTP status
 */
export class CloudModeApiError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly httpStatus?: number,
	) {
		super(message);
		this.name = "CloudModeApiError";
		// Maintain proper stack trace for where error was thrown (V8 only)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, CloudModeApiError);
		}
	}

	/**
	 * Check if this error matches a specific error code
	 */
	is(code: CloudModeErrorCode): boolean {
		return this.code === code;
	}

	/**
	 * Get i18n message key for this error code
	 * Format: cloud_mode_error_{error_code_lowercase}
	 */
	getI18nKey(): string {
		return `cloud_mode_error_${this.code.toLowerCase()}`;
	}
}

/**
 * Parse error response from Cloud Mode API
 * Handles multiple error formats:
 * 1. CloudModeApiError (already parsed)
 * 2. ky HTTPError with JSON response body
 * 3. Generic Error objects
 * 4. Unknown error types
 *
 * Automatically logs all errors for debugging
 */
export async function parseCloudModeError(error: unknown): Promise<CloudModeApiError> {
	// Case 1: Already a CloudModeApiError - just log and return
	if (error instanceof CloudModeApiError) {
		logger.error(`[CloudModeApiError] ${error.code}: ${error.message}`, {
			code: error.code,
			httpStatus: error.httpStatus,
		});
		return error;
	}

	// Case 2: ky HTTPError with response body
	if (error && typeof error === "object" && "response" in error) {
		try {
			const response = (error as { response: Response }).response;
			const httpStatus = response.status;

			// Try to parse response body as JSON
			let body: unknown;
			try {
				body = await response.json();
			} catch {
				// Response body is not JSON
				const apiError = new CloudModeApiError(
					"UNKNOWN_ERROR",
					`HTTP ${httpStatus} error`,
					httpStatus,
				);
				logger.error(`[CloudModeApiError] Failed to parse error response body`, {
					httpStatus,
					error,
				});
				return apiError;
			}

			// Try to parse as CloudModeErrorResponse
			const validated = cloudModeErrorResponseSchema(body);
			if (!(validated instanceof type.errors)) {
				const apiError = new CloudModeApiError(
					validated.error.code,
					validated.error.message,
					httpStatus,
				);
				logger.error(`[CloudModeApiError] ${apiError.code}: ${apiError.message}`, {
					code: apiError.code,
					httpStatus,
					body,
				});
				return apiError;
			}

			// Fallback: extract any error information from body
			if (body && typeof body === "object") {
				const errorObj = body as Record<string, unknown>;
				const message =
					(typeof errorObj.message === "string" ? errorObj.message : undefined) ||
					(typeof errorObj.error === "string" ? errorObj.error : undefined) ||
					`HTTP ${httpStatus} error`;
				const code =
					(typeof errorObj.code === "string" ? errorObj.code : undefined) ||
					"UNKNOWN_ERROR";

				const apiError = new CloudModeApiError(code, message, httpStatus);
				logger.error(`[CloudModeApiError] ${apiError.code}: ${apiError.message}`, {
					code: apiError.code,
					httpStatus,
					body,
				});
				return apiError;
			}
		} catch (parseError) {
			// Failed to parse response body
			logger.error("[CloudModeApiError] Failed to parse HTTPError response", {
				originalError: error,
				parseError,
			});
		}
	}

	// Case 3: Generic Error object
	if (error instanceof Error) {
		const apiError = new CloudModeApiError("UNKNOWN_ERROR", error.message);
		logger.error(`[CloudModeApiError] UNKNOWN_ERROR: ${error.message}`, {
			originalError: error,
		});
		return apiError;
	}

	// Case 4: Unknown error type
	const errorMessage = String(error);
	const apiError = new CloudModeApiError("UNKNOWN_ERROR", errorMessage);
	logger.error(`[CloudModeApiError] UNKNOWN_ERROR: ${errorMessage}`, {
		originalError: error,
	});
	return apiError;
}
