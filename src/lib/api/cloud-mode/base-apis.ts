import {
	CloudModeApiError,
	parseCloudModeError,
	checkErrorResponse,
} from "@shared/storage/cloud-mode-errors";
import {
	createInstanceRequestSchema,
	createInstanceResponseSchema,
	execCommandRequestSchema,
	execCommandResponseSchema,
	getManualRenewChargeResponseSchema,
	initInstanceRequestSchema,
	initInstanceResponseSchema,
	manualRenewRequestSchema,
	manualRenewResponseSchema,
	readFilesRequestSchema,
	readFilesResponseSchema,
	rebootInstanceRequestSchema,
	rebootInstanceResponseSchema,
	restartDockerRequestSchema,
	restartDockerResponseSchema,
	sandboxHealthResponseSchema,
	updateAutoRenewRequestSchema,
	updateAutoRenewResponseSchema,
	updateInstanceAutoRenewRequestSchema,
	updateInstanceAutoRenewResponseSchema,
	writeFilesRequestSchema,
	writeFilesResponseSchema,
	type CloudSandboxHealthResponse,
	type CreateInstanceRequest,
	type CreateInstanceResponse,
	type ExecCommandRequest,
	type ExecCommandResponse,
	type ExecStreamEvent,
	type ExecStreamRequest,
	type GetManualRenewChargeResponse,
	type InitInstanceRequest,
	type InitInstanceResponse,
	type ManualRenewRequest,
	type ManualRenewResponse,
	type ReadFilesRequest,
	type ReadFilesResponse,
	type RebootInstanceRequest,
	type RebootInstanceResponse,
	type RestartDockerRequest,
	type RestartDockerResponse,
	type SandboxHealthResponse,
	type UpdateAutoRenewRequest,
	type UpdateAutoRenewResponse,
	type UpdateInstanceAutoRenewRequest,
	type UpdateInstanceAutoRenewResponse,
	type WriteFilesRequest,
	type WriteFilesResponse,
} from "@shared/storage/cloud-mode";
import { type } from "arktype";
import { _302AIKy } from "../core/_302ai-ky";

/**
 * Get cloud sandbox health status (mock implementation)
 * TODO: Implement actual health check endpoint
 */
export async function getCloudSandboxHealth(
	_publicIp: string,
	_apiPort: number,
): Promise<CloudSandboxHealthResponse> {
	return {
		success: true,
		status: "ok",
		ocStatus: "ok",
	};
}

/**
 * Get available instance list for Apikey
 * @returns List of available instances
 */
// export async function listInstances(): Promise<ListInstancesResponse> {
// 	try {
// 		const response = await _302AIKy.get("302/swas/instances").json();

// 		const validated = listInstancesResponseSchema(response);
// 		if (validated instanceof type.errors) {
// 			logger.error("Failed to validate list instances response:", validated.summary);
// 			throw new Error("Invalid response format from list instances API");
// 		}
// 		return validated;
// 	} catch (error) {
// 		logger.error("Failed to list instances:", error);
// 		throw error;
// 	}
// }

/**
 * Create a cloud compute instance
 * @throws {CloudModeApiError} AI302_INSUFFICIENT_BALANCE - Insufficient balance
 * @throws {CloudModeApiError} APIKEY_INSTANCE_EXISTS - API key already has an instance
 * @throws {CloudModeApiError} CREATE_INSTANCE_FAILED - Failed to create instance
 * @returns Created instance information
 */
export async function createInstance(
	request: CreateInstanceRequest,
): Promise<CreateInstanceResponse> {
	try {
		const requestBody = createInstanceRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy.post("302/swas/instances", { json: requestBody }).json();

		checkErrorResponse(response, "CREATE_INSTANCE_FAILED", "Failed to create instance");

		const validated = createInstanceResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Initialize a cloud instance with the specified configuration.
 * @throws {CloudModeApiError} INIT_INSTANCE_FAILED - Failed to initialize instance
 * @param request - Instance initialization parameters
 * @returns Initialization response with instance details
 */
export async function initInstance(request: InitInstanceRequest): Promise<InitInstanceResponse> {
	try {
		const requestBody = initInstanceRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy
			.post("302/swas/instances/init", { json: requestBody })
			.json();

		checkErrorResponse(response, "INIT_INSTANCE_FAILED", "Failed to initialize instance");

		const validated = initInstanceResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Get instance running status.
 * @param instanceName
 * @returns Instance status
 */
/* export async function getInstanceStatus(instanceName: string): Promise<InstanceStatusResponse> {
	try {
		const response = await _302AIKy
			.get(`302/swas/instances/status?instance_name=${encodeURIComponent(instanceName)}`)
			.json();

		const validated = instanceStatusResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate instance status response:", validated.summary);
			throw new Error("Invalid response format from instance status API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to get instance status:", error);
		throw error;
	}
} */

/**
 * Restart Docker image (optionally update openclaw config first).
 * @throws {CloudModeApiError} SWAS_REBOOT_FAILED - Failed to restart docker
 * @param request
 * @returns Restart docker response
 */
export async function restartDocker(request: RestartDockerRequest): Promise<RestartDockerResponse> {
	try {
		const requestBody = restartDockerRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy
			.post("302/swas/instances/openclaw/restart", { json: requestBody })
			.json();

		checkErrorResponse(response, "SWAS_REBOOT_FAILED", "Failed to restart docker");

		const validated = restartDockerResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Update auto-renew settings for a cloud instance.
 * @throws {CloudModeApiError} UPDATE_AUTO_RENEW_FAILED - Failed to update auto-renew
 * @param request - Auto-renew configuration parameters
 * @returns Update response with new auto-renew status
 */
export async function updateAutoRenew(
	request: UpdateAutoRenewRequest,
): Promise<UpdateAutoRenewResponse> {
	try {
		const requestBody = updateAutoRenewRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy
			.post("302/swas/instances/auto-renew", { json: requestBody })
			.json();

		checkErrorResponse(response, "UPDATE_AUTO_RENEW_FAILED", "Failed to update auto-renew");

		const validated = updateAutoRenewResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Manually renew a cloud instance.
 * @throws {CloudModeApiError} INSTANCE_RENEW_EXPIRED - Instance expired over 15 days
 * @throws {CloudModeApiError} MANUAL_RENEW_FAILED - Failed to manually renew
 * @param request - Manual renew configuration parameters
 * @returns Manual renew response
 */
export async function manualRenew(request: ManualRenewRequest): Promise<ManualRenewResponse> {
	try {
		const requestBody = manualRenewRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy
			.post("302/swas/instances/manual-renew", { json: requestBody })
			.json();

		checkErrorResponse(response, "MANUAL_RENEW_FAILED", "Failed to manually renew");

		const validated = manualRenewResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

// export async function getManualRenewCharge(
// 	instanceName: string,
// 	page = 1,
// 	pageSize = 20,
// ): Promise<GetManualRenewChargeResponse> {
// 	// Mock implementation for testing UI with large amount of data
// 	await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network latency

// 	const total = 45; // Total records
// 	const totalPages = Math.ceil(total / pageSize);
// 	const charges: GetManualRenewChargeResponse["charges"] = [];

// 	const start = (page - 1) * pageSize;
// 	const end = Math.min(start + pageSize, total);

// 	for (let i = start; i < end; i++) {
// 		const date = new Date();
// 		date.setDate(date.getDate() - i);
// 		charges.push({
// 			amountCent: 1000 + i * 100, // Varying amount
// 			chargedAt: date.toISOString(),
// 			instanceName: `${instanceName}_${i}`,
// 		});
// 	}

// 	return {
// 		success: true,
// 		pagination: {
// 			page,
// 			pageSize,
// 			total,
// 			totalPages,
// 		},
// 		charges,
// 	};
// }

/**
 * Query manual renewal charge records for a cloud instance.
 * @param page - Page number for pagination (default: 1)
 * @param pageSize - Number of records per page (default: 20)
 * @returns Paginated list of manual renewal charges
 */
export async function getManualRenewCharge(
	page = 1,
	pageSize = 20,
): Promise<GetManualRenewChargeResponse> {
	try {
		const response = await _302AIKy
			.get(`302/swas/instances/manual-renew/charges?page=${page}&page_size=${pageSize}`)
			.json();

		checkErrorResponse(response, "UNKNOWN_ERROR", "Failed to get manual renew charges");

		const validated = getManualRenewChargeResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Danger: Reboot the instance server (use sparingly).
 * @throws {CloudModeApiError} SWAS_REBOOT_FAILED - Failed to reboot instance
 * @param request
 * @returns Reboot instance response
 */
export async function rebootInstance(
	request: RebootInstanceRequest,
): Promise<RebootInstanceResponse> {
	try {
		const requestBody = rebootInstanceRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy
			.post("302/swas/instances/reboot", { json: requestBody })
			.json();

		checkErrorResponse(response, "SWAS_REBOOT_FAILED", "Failed to reboot instance");

		const validated = rebootInstanceResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Update instance auto-renew settings.
 * @throws {CloudModeApiError} UPDATE_AUTO_RENEW_FAILED - Failed to update auto-renew
 * @param request
 * @returns Update auto renew response
 */
export async function updateInstanceAutoRenew(
	request: UpdateInstanceAutoRenewRequest,
): Promise<UpdateInstanceAutoRenewResponse> {
	try {
		const requestBody = updateInstanceAutoRenewRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy("302/swas/instances/auto-renew", {
			method: "POST",
			json: requestBody,
		}).json();

		checkErrorResponse(response, "UPDATE_AUTO_RENEW_FAILED", "Failed to update auto-renew");

		const validated = updateInstanceAutoRenewResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Read text files from the instance.
 * @param request
 * @returns Read files response
 */
export async function readInstanceFiles(request: ReadFilesRequest): Promise<ReadFilesResponse> {
	try {
		const requestBody = readFilesRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy
			.post("302/swas/instances/files/read", { json: requestBody })
			.json();

		checkErrorResponse(response, "UNKNOWN_ERROR", "Failed to read files");

		const validated = readFilesResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Write files to the instance.
 * @param request
 * @returns Write files response
 */
export async function writeInstanceFiles(request: WriteFilesRequest): Promise<WriteFilesResponse> {
	try {
		const requestBody = writeFilesRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy
			.post("302/swas/instances/files/write", { json: requestBody })
			.json();

		checkErrorResponse(response, "UNKNOWN_ERROR", "Failed to write files");

		const validated = writeFilesResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Execute a shell command on a cloud instance.
 * @param request - Command execution parameters including instance name and command
 * @returns Command execution response with output and exit code
 */
export async function execInstanceCommand(
	request: ExecCommandRequest,
): Promise<ExecCommandResponse> {
	try {
		const requestBody = execCommandRequestSchema(request);
		if (requestBody instanceof type.errors) {
			throw new CloudModeApiError("INVALID_REQUEST", requestBody.summary);
		}

		const response = await _302AIKy
			.post("302/swas/instances/commands/exec", { json: requestBody })
			.json();

		checkErrorResponse(response, "UNKNOWN_ERROR", "Failed to execute command");

		const validated = execCommandResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

export async function getSandboxHealthStatus(
	ip: string,
	port: number,
): Promise<SandboxHealthResponse> {
	try {
		const response = await _302AIKy(
			new URL(`http://${ip}:${port}/302/claude-code/sandbox/health`),
		).json();

		const validated = sandboxHealthResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError(
				"INVALID_RESPONSE",
				`Invalid health check response: ${validated.summary}`,
			);
		}

		return validated;
	} catch (error) {
		// Don't log expected connection errors
		const errorMessage = error instanceof Error ? error.message : String(error);
		const lowerMsg = errorMessage.toLowerCase();
		const isExpectedConnectionError =
			lowerMsg.includes("fetch failed") ||
			lowerMsg.includes("failed to fetch") ||
			lowerMsg.includes("econnrefused") ||
			lowerMsg.includes("connection refused") ||
			lowerMsg.includes("etimedout") ||
			lowerMsg.includes("timed out");

		if (!isExpectedConnectionError) {
			throw await parseCloudModeError(error);
		}

		throw error;
	}
}

/**
 * Execute a command on a cloud instance with streaming output.
 * Server sends NDJSON lines: {"event": "output", "run_id": ..., "text": ...}
 *
 * @param publicInfo - Instance public IP and port
 * @param request - Command execution parameters
 * @param onEvent - Callback invoked for each streaming event
 * @param options.signal - Optional AbortSignal to cancel the stream mid-flight
 * @param options.onDone - Optional callback when stream finishes naturally
 * @param options.onError - Optional callback on stream error
 */
export async function execCommandStream(
	publicInfo: { ip: string; port: number },
	request: ExecStreamRequest,
	onEvent: (event: ExecStreamEvent) => void,
	options?: {
		signal?: AbortSignal;
		onDone?: () => void;
		onError?: (error: Error) => void;
	},
): Promise<void> {
	try {
		const response = await _302AIKy(
			new URL(`http://${publicInfo.ip}:${publicInfo.port}/302/claude-code/commands/stream`),
			{
				method: "POST",
				json: request,
				timeout: false,
				signal: options?.signal,
			},
		);

		const reader = response.body?.getReader();
		if (!reader) throw new Error("No response body stream");

		const decoder = new TextDecoder();
		let buffer = "";

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					const trimmed = line.trim().replace(/^data:\s*/, "");
					if (!trimmed) continue;

					try {
						const event = JSON.parse(trimmed) as ExecStreamEvent;
						onEvent(event);
					} catch (_parseError) {
						// Silently skip unparseable lines
					}
				}
			}

			// Process any remaining data in the buffer
			if (buffer.trim()) {
				try {
					const event = JSON.parse(buffer.trim()) as ExecStreamEvent;
					onEvent(event);
				} catch {
					// Silently skip unparseable buffer
				}
			}

			options?.onDone?.();
		} finally {
			reader.releaseLock();
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			options?.onDone?.();
			return;
		}

		const err = error instanceof Error ? error : new Error(String(error));
		options?.onError?.(err);
		throw err;
	}
}
