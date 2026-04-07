import { createLogger } from "@shared/logger";
import { type } from "arktype";
import { cloudModeKy } from "../core/cloud-mode-ky";

const logger = createLogger("ui");

const { getUserAgentFragment } = window.electronAPI.appService;
const { get302AIApiKey } = window.electronAPI.providerService;

// --- Cloud Sandbox Health Check ---

export const cloudSandboxHealthResponseSchema = type({
	success: "boolean",
	status: "string",
	"oc_status?": "string",
});
export type CloudSandboxHealthResponse = typeof cloudSandboxHealthResponseSchema.infer;

/**
 * Check cloud instance sandbox health.
 * Same endpoint as local mode: GET /302/claude-code/sandbox/health
 * but targeting the cloud instance's public_ip:api_port with API key auth.
 */
export async function getCloudSandboxHealth(
	publicIp: string,
	apiPort: number,
): Promise<CloudSandboxHealthResponse> {
	try {
		const baseUrl = `http://${publicIp}:${apiPort}`;
		const userAgent = await getUserAgentFragment();
		const apiKey = await get302AIApiKey();

		const response = await cloudModeKy
			.get("302/claude-code/sandbox/health", {
				prefixUrl: baseUrl,
				timeout: 10000,
				headers: {
					Authorization: `Bearer ${apiKey}`,
					"User-Agent": userAgent,
					"HTTP-Referer": "https://studio.302.ai/",
					"X-Title": "302.AI Studio",
				},
				retry: 1,
			})
			.json();

		const validated = cloudSandboxHealthResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("[getCloudSandboxHealth] Invalid response:", validated.summary);
			throw new Error("Invalid response format from cloud sandbox health API");
		}
		return validated;
	} catch (error) {
		logger.error("[getCloudSandboxHealth] Failed:", error);
		throw error;
	}
}

// --- Instance Info ---

export const instanceInfoSchema = type({
	instance_name: "string",
	public_ip: "string",
	created_at: "string",
	expired_at: "string",
	"api_port?": "number",
	"oc_port?": "number",
	"openclaw_gateway_token?": "string",
});
export type InstanceInfo = typeof instanceInfoSchema.infer;

// --- List Instances ---

export const listInstancesResponseSchema = type({
	success: "boolean",
	"instances?": instanceInfoSchema.array(),
	"error?": "string",
});
export type ListInstancesResponse = typeof listInstancesResponseSchema.infer;

/**
 * List instances for the current API key.
 * GET /api/v1/instances
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

// --- Create Instance ---

export const createInstanceRequestSchema = type({
	"is_dev?": "boolean",
	"is_auto_renew?": "boolean",
});
export type CreateInstanceRequest = typeof createInstanceRequestSchema.infer;

export const createInstanceResponseSchema = type({
	success: "boolean",
	"instance?": instanceInfoSchema,
	"error?": "string",
});
export type CreateInstanceResponse = typeof createInstanceResponseSchema.infer;

/**
 * Create a cloud compute instance.
 * POST /api/v1/instances
 */
export async function createInstance(
	request: CreateInstanceRequest = {},
): Promise<CreateInstanceResponse> {
	try {
		const response = await cloudModeKy.post("api/v1/instances", { json: request }).json();

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

// --- Instance Status ---

export const instanceStatusResponseSchema = type({
	success: "boolean",
	"instance?": {
		instance_name: "string",
		instance_status: "string",
	},
	"error?": "string",
});
export type InstanceStatusResponse = typeof instanceStatusResponseSchema.infer;

/**
 * Get instance running status.
 * GET /api/v1/instances/status?instance_name=...
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

// --- Restart Docker ---

export const restartDockerRequestSchema = type({
	instance_name: "string",
	"openclaw_config_content?": "string",
});
export type RestartDockerRequest = typeof restartDockerRequestSchema.infer;

export const restartDockerResponseSchema = type({
	success: "boolean",
	"instance_name?": "string",
	"error?": "string",
});
export type RestartDockerResponse = typeof restartDockerResponseSchema.infer;

/**
 * Restart Docker image (optionally update openclaw config first).
 * POST /api/v1/instances/openclaw/restart
 */
export async function restartDocker(request: RestartDockerRequest): Promise<RestartDockerResponse> {
	try {
		const response = await cloudModeKy
			.post("api/v1/instances/openclaw/restart", { json: request })
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

// --- Reboot Instance ---

export const rebootInstanceRequestSchema = type({
	instance_name: "string",
});
export type RebootInstanceRequest = typeof rebootInstanceRequestSchema.infer;

export const rebootInstanceResponseSchema = type({
	success: "boolean",
	"message?": "string",
	"error?": "string",
});
export type RebootInstanceResponse = typeof rebootInstanceResponseSchema.infer;

/**
 * Reboot the instance server (use sparingly).
 * POST /api/v1/instances/reboot
 */
export async function rebootInstance(
	request: RebootInstanceRequest,
): Promise<RebootInstanceResponse> {
	try {
		const response = await cloudModeKy
			.post("api/v1/instances/reboot", { json: request })
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

// --- Read Files ---

export const readFilesRequestSchema = type({
	instance_name: "string",
	file_paths: "string[]",
});
export type ReadFilesRequest = typeof readFilesRequestSchema.infer;

export const fileReadResultSchema = type({
	success: "boolean",
	file_path: "string",
	"file_content?": "string",
});

export const readFilesResponseSchema = type({
	success: "boolean",
	"files?": fileReadResultSchema.array(),
	"error?": "string",
});
export type ReadFilesResponse = typeof readFilesResponseSchema.infer;

/**
 * Read text files from the instance.
 * POST /api/v1/instances/files/read
 */
export async function readInstanceFiles(request: ReadFilesRequest): Promise<ReadFilesResponse> {
	try {
		const response = await cloudModeKy
			.post("api/v1/instances/files/read", { json: request })
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

// --- Write Files ---

export const fileWriteItemSchema = type({
	file_path: "string",
	file_content: "string",
});

export const writeFilesRequestSchema = type({
	instance_name: "string",
	files: fileWriteItemSchema.array(),
});
export type WriteFilesRequest = typeof writeFilesRequestSchema.infer;

export const fileWriteResultSchema = type({
	success: "boolean",
	file_path: "string",
});

export const writeFilesResponseSchema = type({
	success: "boolean",
	"files?": fileWriteResultSchema.array(),
	"error?": "string",
});
export type WriteFilesResponse = typeof writeFilesResponseSchema.infer;

/**
 * Write files to the instance.
 * POST /api/v1/instances/files/write
 */
export async function writeInstanceFiles(request: WriteFilesRequest): Promise<WriteFilesResponse> {
	try {
		const response = await cloudModeKy
			.post("api/v1/instances/files/write", { json: request })
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

// --- Exec Command ---

export const execCommandRequestSchema = type({
	instance_name: "string",
	cmd: "string",
	"cwd?": "string",
});
export type ExecCommandRequest = typeof execCommandRequestSchema.infer;

export const execCommandResponseSchema = type({
	success: "boolean",
	"exit_code?": "number",
	"stdout?": "string",
	"stderr?": "string",
	"error?": "string",
});
export type ExecCommandResponse = typeof execCommandResponseSchema.infer;

/**
 * Execute a command on the instance server.
 * POST /api/v1/instances/commands/exec
 */
export async function execInstanceCommand(
	request: ExecCommandRequest,
): Promise<ExecCommandResponse> {
	try {
		const response = await cloudModeKy
			.post("api/v1/instances/commands/exec", { json: request })
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
