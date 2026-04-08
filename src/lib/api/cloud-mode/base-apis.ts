import { createLogger } from "@shared/logger";
import {
	cloudSandboxHealthResponseSchema,
	createInstanceRequestSchema,
	createInstanceResponseSchema,
	execCommandRequestSchema,
	execCommandResponseSchema,
	instanceStatusResponseSchema,
	listInstancesResponseSchema,
	readFilesRequestSchema,
	readFilesResponseSchema,
	rebootInstanceRequestSchema,
	rebootInstanceResponseSchema,
	restartDockerRequestSchema,
	restartDockerResponseSchema,
	writeFilesRequestSchema,
	writeFilesResponseSchema,
	type CloudSandboxHealthResponse,
	type CreateInstanceRequest,
	type CreateInstanceResponse,
	type ExecCommandRequest,
	type ExecCommandResponse,
	type InstanceStatusResponse,
	type ListInstancesResponse,
	type ReadFilesRequest,
	type ReadFilesResponse,
	type RebootInstanceRequest,
	type RebootInstanceResponse,
	type RestartDockerRequest,
	type RestartDockerResponse,
	type WriteFilesRequest,
	type WriteFilesResponse,
} from "@shared/storage/cloud-mode";
import { type } from "arktype";
import { cloudModeKy } from "../core/cloud-mode-ky";

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
		const response = await cloudModeKy.get("api/v1/instances").json();

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
		const response = await cloudModeKy.post("api/v1/instances", { json: requestBody }).json();

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
 * Get instance running status.
 * @param instanceName
 * @returns Instance status
 */
export async function getInstanceStatus(instanceName: string): Promise<InstanceStatusResponse> {
	try {
		const response = await cloudModeKy
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
}

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
		const response = await cloudModeKy
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
		const response = await cloudModeKy
			.post("api/v1/instances/reboot", { json: requestBody })
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
export async function readInstanceFiles(request: ReadFilesRequest): Promise<ReadFilesResponse> {
	try {
		const requestBody = readFilesRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate read files request:", requestBody.summary);
			throw new Error("Invalid request format for read files");
		}
		const response = await cloudModeKy
			.post("api/v1/instances/files/read", { json: requestBody })
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
		const response = await cloudModeKy
			.post("api/v1/instances/files/write", { json: requestBody })
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

export async function execInstanceCommand(
	request: ExecCommandRequest,
): Promise<ExecCommandResponse> {
	try {
		const requestBody = execCommandRequestSchema(request);
		if (requestBody instanceof type.errors) {
			logger.error("Failed to validate exec command request:", requestBody.summary);
			throw new Error("Invalid request format for exec command");
		}
		const response = await cloudModeKy
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
