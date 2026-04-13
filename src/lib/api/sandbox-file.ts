/**
 * Sandbox File System API Client
 * 302.AI 沙盒文件系统 API
 */

import { createLogger } from "@shared/logger";
import { getCodeAgentKy, isLocalOrCloudMode } from "./utils";

const logger = createLogger("apis");

export interface SandboxFileInfo {
	name: string;
	path: string;
	type: "file" | "dir";
	size?: number;
	modified_time?: string;
}

export interface SandboxFileListResponse {
	success: boolean;
	filelist: SandboxFileInfo[];
}

export interface SandboxFileDownloadResponse {
	success?: boolean;
	error?: {
		message?: string;
		type?: string;
		param?: string | null;
		code?: string;
	};
	result: Array<{
		path: string;
		path_type: string;
		file_list: Array<{
			upload_url: string;
			sandbox_path: string;
		}>;
	}>;
	// 当 API 直接返回文件内容时，保存原始内容
	_directContent?: string;
	_blobContent?: Blob;
	_contentType?: string;
}

/**
 * 查询沙盒中指定路径下的文件列表
 */
export async function listSandboxFiles(
	sandboxId: string,
	path: string | string[],
	depth: number = 1,
): Promise<SandboxFileListResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const requestBody = isLocalOrCloudMode()
			? {
					path,
					depth,
				}
			: {
					sandbox_id: sandboxId,
					path,
					depth,
				};

		const response = await kyInstance.post("302/claude-code/sandbox/file/list", {
			json: requestBody,
		});

		return await response.json();
	} catch (error) {
		logger.error("Failed to list files:", error);
		throw error;
	}
}

/**
 * 构建直接内容响应
 */
function buildDirectContentResponse(
	path: string | string[],
	content: string | Blob,
	contentType: string | null,
): SandboxFileDownloadResponse {
	const filePath = typeof path === "string" ? path : path[0];
	const isBlob = content instanceof Blob;
	return {
		result: [
			{
				path: filePath,
				path_type: "file",
				file_list: [{ upload_url: "", sandbox_path: filePath }],
			},
		],
		...(isBlob
			? { _blobContent: content, _contentType: contentType || "application/octet-stream" }
			: { _directContent: content as string, _contentType: contentType ?? undefined }),
	};
}

/**
 * 解析错误信息
 */
function parseErrorMessage(text: string, fallback: string): string {
	try {
		const json = JSON.parse(text);
		return json.error?.message || fallback;
	} catch {
		return fallback;
	}
}

/**
 * 下载沙盒文件内容
 */
export async function downloadSandboxFile(
	sandboxId: string,
	path: string | string[],
): Promise<SandboxFileDownloadResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const requestBody = isLocalOrCloudMode()
			? {
					path,
				}
			: {
					sandbox_id: sandboxId,
					path,
				};

		const response = await kyInstance.post("302/claude-code/sandbox/file/download", {
			json: requestBody,
		});

		const contentType = response.headers.get("content-type");

		// 非 JSON 内容，直接返回 Blob
		if (!contentType?.includes("application/json")) {
			return buildDirectContentResponse(path, await response.blob(), contentType);
		}

		// JSON 内容处理
		const text = await response.text();
		let jsonData: unknown;
		try {
			jsonData = JSON.parse(text);
		} catch {
			return buildDirectContentResponse(path, text, contentType);
		}

		// 检查错误响应
		if (typeof jsonData === "object" && jsonData !== null) {
			const data = jsonData as Record<string, unknown>;
			if (data.success === false || data.error) {
				const error = data.error as { message?: string } | undefined;
				throw new Error(error?.message || "Download failed");
			}
			// 标准 API 响应
			if (Array.isArray(data.result)) {
				return jsonData as SandboxFileDownloadResponse;
			}
		}

		// JSON 文件内容（如 package.json）
		return buildDirectContentResponse(path, text, contentType);
	} catch (error) {
		// Handle HTTP errors
		if (error && typeof error === "object" && "response" in error) {
			const httpError = error as { response: Response };
			try {
				const errorText = await httpError.response.text();
				throw new Error(
					parseErrorMessage(
						errorText,
						`Failed to download file: ${httpError.response.statusText}`,
					),
				);
			} catch (parseError) {
				throw parseError instanceof Error ? parseError : error;
			}
		}
		throw error;
	}
}

/**
 * 写入文件到沙盒
 */
export async function writeSandboxFile(
	sandboxId: string,
	fileList: Array<{ file: string; save_path: string }>,
): Promise<{ result: string }> {
	try {
		const kyInstance = await getCodeAgentKy();
		const requestBody = isLocalOrCloudMode()
			? {
					file_list: fileList,
				}
			: {
					sandbox_id: sandboxId,
					file_list: fileList,
				};

		const response = await kyInstance.post("302/claude-code/sandbox/file/write", {
			json: requestBody,
		});

		return await response.json();
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Failed to write file: ${error.message}`);
		}
		throw error;
	}
}

/**
 * 获取文件内容（下载并读取）
 * @param signal - Optional AbortSignal to cancel the request
 */
export async function getFileContent(
	sandboxId: string,
	filePath: string,
	signal?: AbortSignal,
): Promise<string> {
	const kyInstance = await getCodeAgentKy();
	const requestBody = isLocalOrCloudMode()
		? {
				path: filePath,
			}
		: {
				sandbox_id: sandboxId,
				path: filePath,
			};

	try {
		// 直接调用下载 API，它会返回文件内容
		const response = await kyInstance.post("302/claude-code/sandbox/file/download", {
			json: requestBody,
			signal, // 传递 AbortSignal 以支持请求取消
		});

		const contentType = response.headers.get("content-type");
		logger.debug("[getFileContent] Content-Type:", contentType);

		// 如果返回的是 JSON，说明返回的是下载 URL
		if (contentType?.includes("application/json")) {
			// Clone response to read json, as we might need text fallback
			const jsonResponse = await response.json();
			logger.debug("[getFileContent] JSON response:", jsonResponse);

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const data = jsonResponse as any;

			// 如果有 download_url，则获取文件内容
			if (data.download_url) {
				const contentResponse = await fetch(data.download_url, { signal });
				if (!contentResponse.ok) {
					throw new Error(`Failed to fetch file content: ${contentResponse.statusText}`);
				}
				return contentResponse.text();
			}

			// 如果是文件内容本身是 JSON，ky.json() 解析了它，我们需要把它转回 string
			// 或者是错误信息
			if (data.success === false) {
				throw new Error(data.error?.message || "Failed to download file");
			}

			// Fallback: request as text if it was json content
			return JSON.stringify(data);
		}

		// 否则，直接返回文本内容
		return response.text();
	} catch (error) {
		if (error && typeof error === "object" && "response" in error) {
			const httpError = error as { response: Response };
			const errorText = await httpError.response.text();
			logger.error("[getFileContent] Error response:", errorText);
			throw new Error(`Failed to download file: ${httpError.response.statusText}`);
		}
		throw error;
	}
}

export enum Operation {
	Copy = "copy",
	Move = "move",
	Remove = "remove",
	Rename = "rename",
	Mkdir = "mkdir",
}

export interface SandboxFileOperationRequest {
	operation: Operation;
	original_path: string;
	sandbox_id?: string;
	target_path?: string;
	[property: string]: unknown;
}

export interface SandboxFileOperationResponse {
	success: boolean;
	result?: string;
	error?: string;
}

/**
 * 文件操作接口
 */
async function sandboxFileOperation(
	sandboxId: string,
	operation: Operation,
	originalPath: string,
	targetPath?: string,
): Promise<SandboxFileOperationResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const requestBody: SandboxFileOperationRequest = {
			operation,
			original_path: originalPath,
		};

		if (!isLocalOrCloudMode()) {
			requestBody.sandbox_id = sandboxId;
		}

		if (targetPath !== undefined) {
			requestBody.target_path = targetPath;
		}

		const response = await kyInstance.post("302/claude-code/sandbox/file/operation", {
			json: requestBody,
		});

		return await response.json();
	} catch (error) {
		if (error && typeof error === "object" && "response" in error) {
			const httpError = error as { response: Response };
			const errorText = await httpError.response.text();
			logger.error("[sandboxFileOperation] Error response:", errorText);
			throw new Error(`Failed to perform file operation: ${httpError.response.statusText}`);
		}
		throw error;
	}
}

/**
 * 重命名文件或文件夹
 */
export async function renameSandboxFile(
	sandboxId: string,
	oldPath: string,
	newPath: string,
): Promise<SandboxFileOperationResponse> {
	return sandboxFileOperation(sandboxId, Operation.Rename, oldPath, newPath);
}

/**
 * 删除文件或文件夹
 */
export async function deleteSandboxFile(
	sandboxId: string,
	path: string,
): Promise<SandboxFileOperationResponse> {
	return sandboxFileOperation(sandboxId, Operation.Remove, path);
}

/**
 * 复制文件或文件夹
 */
export async function copySandboxFile(
	sandboxId: string,
	sourcePath: string,
	destPath: string,
): Promise<SandboxFileOperationResponse> {
	return sandboxFileOperation(sandboxId, Operation.Copy, sourcePath, destPath);
}

/**
 * 创建文件夹
 */
export async function createSandboxFolder(
	sandboxId: string,
	path: string,
): Promise<SandboxFileOperationResponse> {
	return sandboxFileOperation(sandboxId, Operation.Mkdir, path);
}

/**
 * 上传文件到沙盒
 */
export async function uploadSandboxFile(
	sandboxId: string,
	path: string,
	file: File,
	auto_unzip: boolean = false,
): Promise<SandboxFileOperationResponse> {
	try {
		// Optimize for local mode: bypass HTTP upload if file path is available
		if (isLocalOrCloudMode()) {
			// Cast to any to access .path property which is available in Electron but not standard File API
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const filePath = (file as any).path;

			if (filePath && typeof filePath === "string") {
				logger.debug("[SandboxFile] Local mode detected, using direct copy for:", filePath);
				const result = await window.electronAPI.localVibeService.copyToWorkspaceByIpc(
					filePath,
					path,
				);

				if (result.success) {
					return { success: true, result: "File copied successfully" };
				} else {
					return {
						success: false,
						error: result.error || "Failed to copy file to workspace",
					};
				}
			}
		}

		const kyInstance = await getCodeAgentKy();
		const formData = new FormData();
		if (!isLocalOrCloudMode()) {
			formData.append("sandbox_id", sandboxId);
		}
		formData.append("path", path);
		formData.append("file", file);
		if (auto_unzip) {
			formData.append("auto_unzip", "true");
		}

		const response = await kyInstance.post("302/claude-code/sandbox/file/upload", {
			body: formData,
		});

		const data: SandboxFileOperationResponse = await response.json();
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const anyData = data as any;

		if (!data.success && anyData.error && typeof anyData.error === "object") {
			return {
				success: false,
				error: anyData.error.message || JSON.stringify(anyData.error),
			};
		}
		return data;
	} catch (error) {
		logger.error("Error uploading sandbox file:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
