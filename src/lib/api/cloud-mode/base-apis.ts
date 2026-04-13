import { createLogger } from "@shared/logger";
import {
	createInstanceRequestSchema,
	createInstanceResponseSchema,
	execCommandRequestSchema,
	execCommandResponseSchema,
	getManualRenewChargeResponseSchema,
	initInstanceRequestSchema,
	initInstanceResponseSchema,
	listInstancesResponseSchema,
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
	type ListInstancesResponse,
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

const logger = createLogger("apis");

/**
 * Get cloud sandbox health status (mock implementation)
 * TODO: Implement actual health check endpoint
 */
export async function getCloudSandboxHealth(
	_publicIp: string,
	_apiPort: number,
): Promise<CloudSandboxHealthResponse> {
	logger.warn("getCloudSandboxHealth is a mock implementation");
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
export async function listInstances(): Promise<ListInstancesResponse> {
	try {
		const response = await _302AIKy.get("302/swas/instances").json();

		const validated = listInstancesResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate list instances response:", validated.summary);
			throw new Error("Invalid response format from list instances API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to list instances:", error);
		throw error;
	}
}

/**
 * Create a cloud compute instance
 * @error 400 - APIKEY_INSTANCE_EXISTS: one apikey can only bind one master instance
 * @error 500 - CREATE_INSTANCE_FAILED: failed to create instance
 * @returns Created instance information
 */
export async function createInstance(
	request: CreateInstanceRequest,
): Promise<CreateInstanceResponse> {
	try {
		const requestBody = createInstanceRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate create instance request:", requestBody.summary);
			throw new Error("Invalid request format for create instance");
		}
		const response = await _302AIKy.post("302/swas/instances", { json: requestBody }).json();

		const validated = createInstanceResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate create instance response:", validated.summary);
			throw new Error("Invalid response format from create instance API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to create instance:", error);
		throw error;
	}
}

/**
 * Initialize a cloud instance with the specified configuration.
 * @param request - Instance initialization parameters
 * @returns Initialization response with instance details
 */
export async function initInstance(request: InitInstanceRequest): Promise<InitInstanceResponse> {
	try {
		const requestBody = initInstanceRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate init instance request:", requestBody.summary);
			throw new Error("Invalid request format for init instance");
		}
		const response = await _302AIKy
			.post("302/swas/instances/init", { json: requestBody })
			.json();

		const validated = initInstanceResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate init instance response:", validated.summary);
			throw new Error("Invalid response format from init instance API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to init instance:", error);
		throw error;
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
 * @param request
 * @returns Restart docker response
 */
export async function restartDocker(request: RestartDockerRequest): Promise<RestartDockerResponse> {
	try {
		const requestBody = restartDockerRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate restart docker request:", requestBody.summary);
			throw new Error("Invalid request format for restart docker");
		}
		const response = await _302AIKy
			.post("302/swas/instances/openclaw/restart", { json: requestBody })
			.json();

		logger.debug("Restart docker actual response:", response);

		const validated = restartDockerResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate restart docker response:", validated.summary);
			throw new Error("Invalid response format from restart docker API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to restart docker:", error);
		throw error;
	}
}

/**
 * Update auto-renew settings for a cloud instance.
 * @param request - Auto-renew configuration parameters
 * @returns Update response with new auto-renew status
 */
export async function updateAutoRenew(
	request: UpdateAutoRenewRequest,
): Promise<UpdateAutoRenewResponse> {
	try {
		const requestBody = updateAutoRenewRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate update auto renew request:", requestBody.summary);
			throw new Error("Invalid request format for update auto renew");
		}
		const response = _302AIKy
			.post("302/swas/instances/auto-renew", { json: requestBody })
			.json();

		const validated = updateAutoRenewResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate update auto renew response:", validated.summary);
			throw new Error("Invalid response format from update auto renew API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to update auto renew:", error);
		throw error;
	}
}

/**
 * Manually renew a cloud instance.
 * @throws 400 INSTANCE_RENEW_EXPIRED: Instance has been expired for more than 15 days and cannot be renewed
 * @throws 409 INSTANCE_LOCKED: The same instance is being operated by another request
 * @throws 500 SWAS_RENEW_INSTANCE_FAILED: Failed to renew the instance
 * @throws 500 MANUAL_RENEW_FAILED: Failed to manually renew the instance
 * @param request - Manual renew configuration parameters
 * @returns Manual renew response
 */
export async function manualRenew(request: ManualRenewRequest): Promise<ManualRenewResponse> {
	try {
		const requestBody = manualRenewRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate manual renew request:", requestBody.summary);
			throw new Error("Invalid request format for manual renew");
		}
		const response = _302AIKy
			.post("302/swas/instances/manual-renew", { json: requestBody })
			.json();

		const validated = manualRenewResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate manual renew response:", validated.summary);
			throw new Error("Invalid response format from manual renew API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to manual renew:", error);
		throw error;
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
 * @param instanceName - Name of the instance to query
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

		const validated = getManualRenewChargeResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error(
				"Failed to validate get manual renew charges response:",
				validated.summary,
			);
			throw new Error("Invalid response format from manual renew charges API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to get manual renew charges:", error);
		throw error;
	}
}

/**
 * Danger: Reboot the instance server (use sparingly).
 * @param request
 * @returns Reboot instance response
 */
export async function rebootInstance(
	request: RebootInstanceRequest,
): Promise<RebootInstanceResponse> {
	try {
		const requestBody = rebootInstanceRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate reboot instance request:", requestBody.summary);
			throw new Error("Invalid request format for reboot instance");
		}
		const response = await _302AIKy
			.post("302/swas/instances/reboot", { json: requestBody })
			.json();

		const validated = rebootInstanceResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate reboot instance response:", validated.summary);
			throw new Error("Invalid response format from reboot instance API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to reboot instance:", error);
		throw error;
	}
}

/**
 * Read text files from the instance.
 * @param request
 * @returns Read files response
 */
export async function updateInstanceAutoRenew(
	request: UpdateInstanceAutoRenewRequest,
): Promise<UpdateInstanceAutoRenewResponse> {
	try {
		const requestBody = updateInstanceAutoRenewRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate update auto renew request:", requestBody.summary);
			throw new Error("Invalid request format for update auto renew");
		}
		const response = await _302AIKy("302/swas/instances/auto-renew", {
			method: "POST",
			json: requestBody,
		}).json();

		const validated = updateInstanceAutoRenewResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate update auto renew response:", validated.summary);
			throw new Error("Invalid response format from update auto renew API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to update instance auto renew:", error);
		throw error;
	}
}

export async function readInstanceFiles(request: ReadFilesRequest): Promise<ReadFilesResponse> {
	try {
		const requestBody = readFilesRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate read files request:", requestBody.summary);
			throw new Error("Invalid request format for read files");
		}
		const response = _302AIKy
			.post("302/swas/instances/files/read", { json: requestBody })
			.json();

		const validated = readFilesResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate read files response:", validated.summary);
			throw new Error("Invalid response format from read files API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to read instance files:", error);
		throw error;
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
			logger.error("Failed to validate write files request:", requestBody.summary);
			throw new Error("Invalid request format for write files");
		}
		const response = _302AIKy
			.post("302/swas/instances/files/write", { json: requestBody })
			.json();

		const validated = writeFilesResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate write files response:", validated.summary);
			throw new Error("Invalid response format from write files API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to write instance files:", error);
		throw error;
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
			logger.error("Failed to validate exec command request:", requestBody.summary);
			throw new Error("Invalid request format for exec command");
		}
		const response = _302AIKy
			.post("302/swas/instances/commands/exec", { json: requestBody })
			.json();

		const validated = execCommandResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate exec command response:", validated.summary);
			throw new Error("Invalid response format from exec command API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to exec instance command:", error);
		throw error;
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
		logger.debug("[getSandboxHealthStatus] Health check response:", response);
		const validated = sandboxHealthResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate health check response:", validated.summary);
			throw new Error(`Invalid health check response: ${validated.summary}`);
		}
		return validated;
	} catch (error) {
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
			logger.error("[getSandboxHealthStatus] Health check failed:", error);
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
						logger.warn("[execCommandStream] Failed to parse line:", trimmed);
					}
				}
			}

			// Process any remaining data in the buffer
			if (buffer.trim()) {
				try {
					const event = JSON.parse(buffer.trim()) as ExecStreamEvent;
					onEvent(event);
				} catch {
					logger.warn("[execCommandStream] Failed to parse final buffer:", buffer);
				}
			}

			options?.onDone?.();
		} finally {
			reader.releaseLock();
		}
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			logger.debug("[execCommandStream] Stream aborted by user");
			options?.onDone?.();
			return;
		}

		const err = error instanceof Error ? error : new Error(String(error));
		logger.error("[execCommandStream] Stream error:", err);
		options?.onError?.(err);
		throw err;
	}
}
