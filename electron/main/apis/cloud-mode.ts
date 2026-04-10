import type {
	ListInstancesResponse,
	ReadFilesRequest,
	ReadFilesResponse,
	RestartDockerRequest,
	RestartDockerResponse,
} from "@shared/storage/cloud-mode";
import {
	listInstancesResponseSchema,
	readFilesRequestSchema,
	readFilesResponseSchema,
	restartDockerRequestSchema,
	restartDockerResponseSchema,
} from "@shared/storage/cloud-mode";
import { type } from "arktype";

import { createLogger } from "@shared/logger";
import { testKy } from "./core/test-ky";

const logger = createLogger("apis");

/**
 * Get available instance list for Apikey
 * @returns List of available instances
 */
export async function listInstances(): Promise<ListInstancesResponse> {
	try {
		const response = await testKy.get("api/v1/instances").json();

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
 * Method: POST /api/v1/instances/openclaw/restart
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

		const response = await testKy
			.post("api/v1/instances/openclaw/restart", { json: requestBody })
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
 * Method: POST /api/v1/instances/files/read
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

		const response = await testKy
			.post("api/v1/instances/files/read", { json: requestBody })
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
