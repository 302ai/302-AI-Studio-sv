import type {
	ListInstancesResponse,
	ReadFilesRequest,
	ReadFilesResponse,
	RestartDockerRequest,
	RestartDockerResponse,
	SandboxHealthResponse,
} from "@shared/storage/cloud-mode";
import {
	listInstancesResponseSchema,
	readFilesRequestSchema,
	readFilesResponseSchema,
	restartDockerRequestSchema,
	restartDockerResponseSchema,
	sandboxHealthResponseSchema,
} from "@shared/storage/cloud-mode";
import { CloudModeApiError, parseCloudModeError } from "@shared/storage/cloud-mode-errors";
import { type } from "arktype";

import { _302AIKy } from "./core/_302ai-ky";

/**
 * Get available instance list for Apikey
 * @returns List of available instances
 */
export async function listInstances(): Promise<ListInstancesResponse> {
	try {
		const response = await _302AIKy.get("302/swas/instances").json();

		// Check for error response
		if (response && typeof response === "object" && "success" in response) {
			if (response.success === false && "error" in response) {
				const errorObj = response.error as { code?: string; message?: string };
				throw new CloudModeApiError(
					errorObj.code || "SWAS_LIST_INSTANCE_FAILED",
					errorObj.message || "Failed to list instances",
				);
			}
		}

		const validated = listInstancesResponseSchema(response);
		if (validated instanceof type.errors) {
			throw new CloudModeApiError("INVALID_RESPONSE", validated.summary);
		}

		return validated;
	} catch (error) {
		throw await parseCloudModeError(error);
	}
}

/**
 * Restart Docker image (optionally update openclaw config first).
 * Method: POST /302/swas/instances/openclaw/restart
 * @param request - Instance name and optional openclaw config content
 * @returns Restart docker response with instance name
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

		// Check for error response
		if (response && typeof response === "object" && "success" in response) {
			if (response.success === false && "error" in response) {
				const errorObj = response.error as { code?: string; message?: string };
				throw new CloudModeApiError(
					errorObj.code || "SWAS_REBOOT_FAILED",
					errorObj.message || "Failed to restart docker",
				);
			}
		}

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
 * Read text files from the instance.
 * Method: POST /302/swas/instances/files/read
 * @param request - Instance name and file paths to read
 * @returns Read files response with file contents
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

		// Check for error response
		if (response && typeof response === "object" && "success" in response) {
			if (response.success === false && "error" in response) {
				const errorObj = response.error as { code?: string; message?: string };
				throw new CloudModeApiError(
					errorObj.code || "UNKNOWN_ERROR",
					errorObj.message || "Failed to read files",
				);
			}
		}

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
 * Get sandbox health status directly from the instance.
 * @param ip - Instance public IP
 * @param port - Instance API port
 * @returns Sandbox health response
 */
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
