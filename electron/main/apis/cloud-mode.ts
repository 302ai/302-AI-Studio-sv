import type {
	CreateInstanceRequest,
	CreateInstanceResponse,
	ListInstancesResponse,
} from "@shared/storage/cloud-mode";
import {
	createInstanceRequestSchema,
	createInstanceResponseSchema,
	listInstancesResponseSchema,
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
