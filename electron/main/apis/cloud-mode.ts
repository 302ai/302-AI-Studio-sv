import type { ListInstancesResponse } from "@shared/storage/cloud-mode";
import { listInstancesResponseSchema } from "@shared/storage/cloud-mode";
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
