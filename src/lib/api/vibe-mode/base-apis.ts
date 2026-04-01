import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
import { type } from "arktype";
import { getCodeAgentKy } from "../utils";
import { createLogger } from "@shared/logger";

const logger = createLogger("ui");

export const executeCommandRequestSchema = type({
	sandboxId: "string",
	command: "string",
	cwd: "string",
});
export type ExecuteCommandRequest = typeof executeCommandRequestSchema.infer;
export const executeCommandResponseSchema = type({
	success: "boolean",
	result: {
		exit_code: "number",
		stdout: "string",
		stderr: "string",
		error: "string",
	},
});
export type ExecuteCommandResponse = typeof executeCommandResponseSchema.infer;

/**
 * Executes a command in the specified sandbox.
 * @param request The command execution request.
 * @param maxRetries Maximum number of retries on failure (default: 3).
 * @returns The command execution response.
 */
export async function executeCommand(
	request: ExecuteCommandRequest,
): Promise<ExecuteCommandResponse> {
	try {
		const kyInstance = await getCodeAgentKy();

		// Local mode doesn't need sandbox_id
		const requestBody =
			codeAgentState.type === "local"
				? {
						command: request.command,
					}
				: {
						sandbox_id: request.sandboxId,
						command: request.command,
					};

		const response = await kyInstance
			.post("302/claude-code/commands", {
				json: requestBody,
			})
			.json();

		const validated = executeCommandResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate execute command response:", validated.summary);
			throw new Error("Invalid response format from execute command API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to execute command:", error);
		throw error;
	}
}

export const sandboxFileOperationResponseSchema = type({
	success: "boolean",
	file: {
		name: "string",
		type: "string",
		path: "string",
		size: "number",
	},
});
export type SandboxFileOperationResponse = typeof sandboxFileOperationResponseSchema.infer;

/**
 * Uploads a file to the specified sandbox.
 * @param sandboxId The ID of the sandbox to upload the file to.
 * @param path The path where the file should be uploaded.
 * @param file The file to upload.
 * @param auto_unzip Whether to automatically unzip the file after upload.
 * @returns The file operation response.
 */
export async function uploadFileToSandbox(
	sandboxId: string,
	path: string,
	file: File,
	auto_unzip: boolean = false,
): Promise<SandboxFileOperationResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const formData = new FormData();

		// Local mode doesn't need sandbox_id
		if (codeAgentState.type !== "local") {
			formData.append("sandbox_id", sandboxId);
		}
		formData.append("path", path);
		formData.append("file", file);
		if (auto_unzip) {
			formData.append("auto_unzip", "true");
		}

		const response = await kyInstance
			.post("302/claude-code/sandbox/file/upload", {
				body: formData,
			})
			.json();

		const validated = sandboxFileOperationResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate upload file response:", validated.summary);
			throw new Error("Invalid response format from upload file API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to upload file:", error);
		throw error;
	}
}

export const initProjectRequestSchema = type({
	sandboxId: "string",
	sessionId: "string",
	workspacePath: "string",
});
export type InitProjectRequest = typeof initProjectRequestSchema.infer;
export const initProjectResponseSchema = type({
	success: "boolean",
	workspace_path: "string",
	session_id: "string",
	message: "string",
});
export type InitProjectResponse = typeof initProjectResponseSchema.infer;

export async function initProject(request: InitProjectRequest): Promise<InitProjectResponse> {
	try {
		const isClawMode = codeAgentState.currentAgentId === "open-claw";

		// Local mode only needs session_id + workspace_path, remote mode needs sandbox_id too
		const requestBody =
			codeAgentState.type === "local"
				? {
						session_id: request.sessionId,
						workspace_path: request.workspacePath,
						agent_type: Number(isClawMode),
					}
				: {
						sandbox_id: request.sandboxId,
						session_id: request.sessionId,
						workspace_path: request.workspacePath,
						agent_type: Number(isClawMode),
					};

		const kyInstance = await getCodeAgentKy();
		const response = await kyInstance
			.post("302/claude-code/sandbox/project/init", {
				json: requestBody,
			})
			.json();

		const validated = initProjectResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate init project response:", validated.summary);
			throw new Error("Invalid response format from init project API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to init project:", error);
		throw error;
	}
}

// Batch Upload File API
export const batchUploadFileRequestSchema = type({
	sandbox_id: "string",
	file_list: type({
		content: "string",
		save_path: "string",
	}).array(),
	ts: "number?",
});
export type BatchUploadFileRequest = typeof batchUploadFileRequestSchema.infer;

export const batchUploadFileResponseSchema = type({
	success: "boolean",
	result: type({
		success: "boolean",
		file: {
			save_path: "string",
		},
		error: "string?",
	}).array(),
});
export type BatchUploadFileResponse = typeof batchUploadFileResponseSchema.infer;

/**
 * Batch uploads files to the specified sandbox.
 * @param request The batch upload request containing sandbox_id and file_list.
 * @returns The batch upload response.
 */
export async function batchUploadFile(
	request: BatchUploadFileRequest,
): Promise<BatchUploadFileResponse> {
	try {
		const kyInstance = await getCodeAgentKy();

		// Local mode doesn't need sandbox_id
		const requestBody =
			codeAgentState.type === "local"
				? {
						file_list: request.file_list,
					}
				: request;

		const response = await kyInstance
			.post("302/claude-code/sandbox/file/upload/batch", {
				json: requestBody,
				timeout: 300000,
			})
			.json();

		logger.info("Batch upload raw response:", JSON.stringify(response, null, 2));

		const validated = batchUploadFileResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate batch upload file response:", validated.summary);
			throw new Error("Invalid response format from batch upload file API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to batch upload files:", error);
		throw error;
	}
}

export const formatType = type("'txt' | 'text' | 'log' | 'md' | 'rst'")
	.or(
		"'json' | 'jsonl' | 'xml' | 'yaml' | 'yml' | 'toml' | 'ini' | 'conf' | 'cfg' | 'properties' | 'csv' | 'tsv'",
	)
	.or(
		"'py' | 'js' | 'ts' | 'java' | 'c' | 'cc' | 'cpp' | 'h' | 'hpp' | 'go' | 'rs' | 'sh' | 'bat' | 'ps1' | 'php' | 'rb' | 'sql' | 'css' | 'html'",
	);
export type FormatType = typeof formatType.infer;
export const downloadFilesRequestSchema = type({
	sandboxId: "string",
	path: "string",
	format: formatType,
});
export type DownloadFilesRequest = typeof downloadFilesRequestSchema.infer;
export const downloadFilesResponseSchema = type({
	format: formatType,
	path: "string",
	content: "string",
	filename: "string",
});
export type DownloadFilesResponse = typeof downloadFilesResponseSchema.infer;

export async function downloadFilesFromSandbox(
	request: DownloadFilesRequest,
): Promise<DownloadFilesResponse> {
	const { sandboxId, path, format } = request;
	try {
		const kyInstance = await getCodeAgentKy();

		// Local mode doesn't need sandbox_id
		const requestBody =
			codeAgentState.type === "local"
				? {
						path,
						format,
					}
				: {
						sandbox_id: sandboxId,
						path,
						format,
					};

		const response = await kyInstance
			.post("302/claude-code/sandbox/file/download", {
				json: requestBody,
			})
			.json();

		const validated = downloadFilesResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate download files response:", validated.summary);
			throw new Error("Invalid response format from download files API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to download files:", error);
		throw error;
	}
}
