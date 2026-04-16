import { createLogger } from "@shared/logger";
import { type } from "arktype";
import { getCodeAgentKy, isLocalOrCloudMode } from "./utils";

const logger = createLogger("apis");

export const deploySandboxRequestSchema = type({
	sandbox_id: "string",
	session_id: "string?",
});
export type DeploySandboxRequest = typeof deploySandboxRequestSchema.infer;
export const deploySandboxResponseSchema = type({
	success: "boolean",
	status: "string",
	id: "string",
	url: "string",
	cover: "string",
	"error?": "string",
});
export type DeploySandboxResponse = typeof deploySandboxResponseSchema.infer;

/**
 * Extract error message from deploy API response.
 * Handles two response shapes:
 * 1. `{ success: false, error: "string..." }` — top-level error string
 * 2. `{ success: false, error: { message: "string..." } }` — nested error object
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractDeployError(response: any): string | undefined {
	if (!response?.error) return undefined;
	if (typeof response.error === "string") return response.error;
	if (typeof response.error === "object" && typeof response.error.message === "string") {
		return response.error.message;
	}
	return undefined;
}

/**
 * Deploy sandbox project to 302.AI hosting service (New implementation)
 */
export async function deploySandboxProject(
	request: DeploySandboxRequest,
): Promise<DeploySandboxResponse> {
	try {
		const kyInstance = await getCodeAgentKy();

		// Local mode doesn't need sandbox_id
		const requestBody = isLocalOrCloudMode()
			? {
					session_id: request.session_id,
				}
			: request;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const response: any = await kyInstance
			.post("302/claude-code/sandbox/deploy", {
				json: requestBody,
			})
			.json();

		// Handle error responses that may not match the success schema
		if (response?.success === false) {
			const errorMsg = extractDeployError(response);
			return {
				success: false,
				status: response.status ?? "failed",
				id: response.id ?? "",
				url: response.url ?? "",
				cover: response.cover ?? "",
				error: errorMsg,
			};
		}

		const validated = deploySandboxResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate deploy sandbox response:", validated.summary);
			throw new Error("Invalid response format from deploy sandbox API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to deploy sandbox project:", error);

		// ky throws HTTPError on non-2xx responses (e.g. 500).
		// Try to read the response body to extract the actual deploy error.
		if (error && typeof error === "object" && "response" in error) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const body = await (error as any).response.json();
				const errorMsg = extractDeployError(body);
				if (errorMsg) {
					return {
						success: false,
						status: body?.status ?? "failed",
						id: body?.id ?? "",
						url: body?.url ?? "",
						cover: body?.cover ?? "",
						error: errorMsg,
					};
				}
			} catch {
				// Response body couldn't be parsed, fall through to throw
			}
		}

		throw error;
	}
}
