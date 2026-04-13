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
import { type } from "arktype";

import { createLogger } from "@shared/logger";
import { _302AIKy } from "./core/_302ai-ky";

const logger = createLogger("apis");

/**
 * Get available instance list for Apikey
 * @returns List of available instances
 */
export async function listInstances(): Promise<ListInstancesResponse> {
	try {
		const response = await _302AIKy.get("302/swas/instances").json();

		const validated = listInstancesResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error(
				"Failed to validate list instances response:",
				validated.summary,
				JSON.stringify(response),
			);
			throw new Error("Invalid response format from list instances API");
		}

		logger.debug("List instances response:", JSON.stringify(validated));
		return validated;
	} catch (error) {
		logger.error("Failed to list instances:", error);
		throw error;
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
			logger.error("Failed to validate restart docker request:", requestBody.summary);
			throw new Error("Invalid request format for restart docker");
		}

		const response = await _302AIKy
			.post("302/swas/instances/openclaw/restart", { json: requestBody })
			.json();

		const validated = restartDockerResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error(
				"Failed to validate restart docker response:",
				validated.summary,
				JSON.stringify(response),
			);
			throw new Error("Invalid response format from restart docker API");
		}

		logger.debug("Restart docker response:", JSON.stringify(validated));
		return validated;
	} catch (error) {
		logger.error("Failed to restart docker:", error);
		throw error;
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
			logger.error("Failed to validate read files request:", requestBody.summary);
			throw new Error("Invalid request format for read files");
		}

		const response = await _302AIKy
			.post("302/swas/instances/files/read", { json: requestBody })
			.json();

		const validated = readFilesResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error(
				"Failed to validate read files response:",
				validated.summary,
				JSON.stringify(response),
			);
			throw new Error("Invalid response format from read files API");
		}

		logger.debug("Read files response:", JSON.stringify(validated));
		return validated;
	} catch (error) {
		logger.error("Failed to read instance files:", error);
		throw error;
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
