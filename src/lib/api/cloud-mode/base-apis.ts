import { createLogger } from "@shared/logger";
import {
	createInstanceRequestSchema,
	createInstanceResponseSchema,
	execCommandRequestSchema,
	execCommandResponseSchema,
	initInstanceRequestSchema,
	initInstanceResponseSchema,
	listInstancesResponseSchema,
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
	type InitInstanceRequest,
	type InitInstanceResponse,
	type ListInstancesResponse,
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
import { testKy } from "../core/test-ky";

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
		const response = await testKy.get("api/v1/instances").json();

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
		const response = await testKy.post("api/v1/instances", { json: requestBody }).json();

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
		const response = await testKy.post("api/v1/instances/init", { json: requestBody }).json();

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
		const response = await testKy
			.get(`api/v1/instances/status?instance_name=${encodeURIComponent(instanceName)}`)
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
		const response = testKy
			.post("api/v1/instances/openclaw/restart", { json: requestBody })
			.json();

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
		const response = testKy.post("api/v1/instances/auto-renew", { json: requestBody }).json();

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
		const response = await testKy.post("api/v1/instances/reboot", { json: requestBody }).json();

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
		// const kyInstance = await testKy();
		const response = await testKy("api/v1/instances/auto-renew", {
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
		const response = testKy.post("api/v1/instances/files/read", { json: requestBody }).json();

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
		const response = testKy.post("api/v1/instances/files/write", { json: requestBody }).json();

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
		const response = testKy
			.post("api/v1/instances/commands/exec", { json: requestBody })
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
		const response = await testKy(
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
