import { createLogger } from "@shared/logger";
import {
	execCommandRequestSchema,
	execCommandResponseSchema,
	readFilesRequestSchema,
	readFilesResponseSchema,
	rebootInstanceRequestSchema,
	rebootInstanceResponseSchema,
	restartDockerRequestSchema,
	restartDockerResponseSchema,
	writeFilesRequestSchema,
	writeFilesResponseSchema,
	type CloudSandboxHealthResponse,
	type ExecCommandRequest,
	type ExecCommandResponse,
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
