import { createLogger } from "@shared/logger";
import { cloudModeKy } from "./core/cloud-mode-ky";

const logger = createLogger("ui");

const { getUserAgentFragment } = window.electronAPI.appService;
const { get302AIApiKey } = window.electronAPI.providerService;

// --- Cloud Sandbox Health Check ---

export interface CloudSandboxHealthResponse {
	success: boolean;
	status: "ok" | string;
	oc_status?: "ok" | string;
}

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
			.json<CloudSandboxHealthResponse>();

		return response;
	} catch (error) {
		logger.error("[getCloudSandboxHealth] Failed:", error);
		return { success: false, status: "error" };
	}
}

// --- Types ---

export interface InstanceInfo {
	instance_name: string;
	public_ip: string;
	created_at: string;
	expired_at: string;
	api_port?: number;
	oc_port?: number;
	openclaw_gateway_token?: string;
}

// Create Instance
export interface CreateInstanceRequest {
	is_dev?: boolean;
	is_auto_renew?: boolean;
}

export interface CreateInstanceResponse {
	success: boolean;
	instance?: InstanceInfo;
	error?: string;
}

// List Instances
export interface ListInstancesResponse {
	success: boolean;
	instances?: InstanceInfo[];
	error?: string;
}

// Instance Status
export interface InstanceStatusResponse {
	success: boolean;
	instance?: {
		instance_name: string;
		instance_status: string;
	};
	error?: string;
}

// Restart Docker
export interface RestartDockerRequest {
	instance_name: string;
	openclaw_config_content?: string;
}

export interface RestartDockerResponse {
	success: boolean;
	instance_name?: string;
	error?: string;
}

// Reboot Instance
export interface RebootInstanceRequest {
	instance_name: string;
}

export interface RebootInstanceResponse {
	success: boolean;
	message?: string;
	error?: string;
}

// Read Files
export interface ReadFilesRequest {
	instance_name: string;
	file_paths: string[];
}

export interface FileReadResult {
	success: boolean;
	file_path: string;
	file_content?: string;
}

export interface ReadFilesResponse {
	success: boolean;
	files?: FileReadResult[];
	error?: string;
}

// Write Files
export interface FileWriteItem {
	file_path: string;
	file_content: string;
}

export interface WriteFilesRequest {
	instance_name: string;
	files: FileWriteItem[];
}

export interface FileWriteResult {
	success: boolean;
	file_path: string;
}

export interface WriteFilesResponse {
	success: boolean;
	files?: FileWriteResult[];
	error?: string;
}

// Exec Command
export interface ExecCommandRequest {
	instance_name: string;
	cmd: string;
	cwd?: string;
}

export interface ExecCommandResponse {
	success: boolean;
	exit_code?: number;
	stdout?: string;
	stderr?: string;
	error?: string;
}

// --- Helpers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractErrorMessage(response: any): string | undefined {
	if (!response?.error) return undefined;
	if (typeof response.error === "string") return response.error;
	if (typeof response.error === "object" && typeof response.error.message === "string") {
		return response.error.message;
	}
	return undefined;
}

function wrapError(error: unknown): string {
	if (error && typeof error === "object" && "response" in error) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return extractErrorMessage((error as any).response) ?? String(error);
		} catch {
			// fall through
		}
	}
	return error instanceof Error ? error.message : String(error);
}

// --- API ---

/**
 * List instances for the current API key.
 * GET /api/v1/instances
 */
export async function listInstances(): Promise<ListInstancesResponse> {
	try {
		const response = await cloudModeKy.get("api/v1/instances").json<ListInstancesResponse>();

		if (response?.success === false) {
			return { success: false, error: extractErrorMessage(response) ?? "Unknown error" };
		}

		return response;
	} catch (error) {
		logger.error("Failed to list instances:", error);
		return { success: false, error: wrapError(error) };
	}
}

/**
 * Create a cloud compute instance.
 * POST /api/v1/instances
 */
export async function createInstance(
	request: CreateInstanceRequest = {},
): Promise<CreateInstanceResponse> {
	try {
		const response = await cloudModeKy
			.post("api/v1/instances", { json: request })
			.json<CreateInstanceResponse>();

		if (response?.success === false) {
			return { success: false, error: extractErrorMessage(response) ?? "Unknown error" };
		}

		return response;
	} catch (error) {
		logger.error("Failed to create instance:", error);

		// Try to extract error from HTTP error response
		if (error && typeof error === "object" && "response" in error) {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const body = await (error as any).response.json();
				const errorMsg = extractErrorMessage(body);
				if (errorMsg) {
					return { success: false, error: errorMsg };
				}
			} catch {
				// fall through
			}
		}

		throw error;
	}
}

/**
 * Get instance running status.
 * GET /api/v1/instances/status?instance_name=...
 */
export async function getInstanceStatus(instanceName: string): Promise<InstanceStatusResponse> {
	try {
		const response = await cloudModeKy
			.get(`api/v1/instances/status?instance_name=${encodeURIComponent(instanceName)}`)
			.json<InstanceStatusResponse>();

		if (response?.success === false) {
			return { success: false, error: extractErrorMessage(response) ?? "Unknown error" };
		}

		return response;
	} catch (error) {
		logger.error("Failed to get instance status:", error);
		return { success: false, error: wrapError(error) };
	}
}

/**
 * Restart Docker image (optionally update openclaw config first).
 * POST /api/v1/instances/openclaw/restart
 */
export async function restartDocker(request: RestartDockerRequest): Promise<RestartDockerResponse> {
	try {
		const response = await cloudModeKy
			.post("api/v1/instances/openclaw/restart", { json: request })
			.json<RestartDockerResponse>();

		if (response?.success === false) {
			return { success: false, error: extractErrorMessage(response) ?? "Unknown error" };
		}

		return response;
	} catch (error) {
		logger.error("Failed to restart docker:", error);
		return { success: false, error: wrapError(error) };
	}
}

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
			.json<RebootInstanceResponse>();

		if (response?.success === false) {
			return { success: false, error: extractErrorMessage(response) ?? "Unknown error" };
		}

		return response;
	} catch (error) {
		logger.error("Failed to reboot instance:", error);
		return { success: false, error: wrapError(error) };
	}
}

/**
 * Read text files from the instance.
 * POST /api/v1/instances/files/read
 */
export async function readInstanceFiles(request: ReadFilesRequest): Promise<ReadFilesResponse> {
	try {
		const response = await cloudModeKy
			.post("api/v1/instances/files/read", { json: request })
			.json<ReadFilesResponse>();

		if (response?.success === false) {
			return { success: false, error: extractErrorMessage(response) ?? "Unknown error" };
		}

		return response;
	} catch (error) {
		logger.error("Failed to read instance files:", error);
		return { success: false, error: wrapError(error) };
	}
}

/**
 * Write files to the instance.
 * POST /api/v1/instances/files/write
 */
export async function writeInstanceFiles(request: WriteFilesRequest): Promise<WriteFilesResponse> {
	try {
		const response = await cloudModeKy
			.post("api/v1/instances/files/write", { json: request })
			.json<WriteFilesResponse>();

		if (response?.success === false) {
			return { success: false, error: extractErrorMessage(response) ?? "Unknown error" };
		}

		return response;
	} catch (error) {
		logger.error("Failed to write instance files:", error);
		return { success: false, error: wrapError(error) };
	}
}

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
			.json<ExecCommandResponse>();

		if (response?.success === false) {
			return { success: false, error: extractErrorMessage(response) ?? "Unknown error" };
		}

		return response;
	} catch (error) {
		logger.error("Failed to exec instance command:", error);
		return { success: false, error: wrapError(error) };
	}
}
