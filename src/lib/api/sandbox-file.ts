/**
 * Sandbox File System API Client
 * 302.AI 沙盒文件系统 API
 */

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
	result: Array<{
		path: string;
		path_type: string;
		file_list: Array<{
			upload_url: string;
			sandbox_path: string;
		}>;
	}>;
}

/**
 * 查询沙盒中指定路径下的文件列表
 */
export async function listSandboxFiles(
	sandboxId: string,
	path: string | string[],
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<SandboxFileListResponse> {
	const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/list`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			sandbox_id: sandboxId,
			path,
			depth: 20,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to list files: ${response.statusText}`);
	}

	return response.json();
}

/**
 * 下载沙盒文件内容
 */
export async function downloadSandboxFile(
	sandboxId: string,
	path: string | string[],
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<SandboxFileDownloadResponse> {
	const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/download`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			sandbox_id: sandboxId,
			path,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("[downloadSandboxFile] Error response:", errorText);
		throw new Error(`Failed to download file: ${response.statusText}`);
	}

	const contentType = response.headers.get("content-type");
	console.log("[downloadSandboxFile] Content-Type:", contentType);

	// 如果返回的是 JSON，解析为 JSON
	if (contentType?.includes("application/json")) {
		return response.json();
	}

	// 否则，假设直接返回的是文件内容
	const text = await response.text();
	console.log("[downloadSandboxFile] Response text (first 200 chars):", text.substring(0, 200));

	// 包装成期望的格式
	return {
		result: [
			{
				path: typeof path === "string" ? path : path[0],
				path_type: "file",
				file_list: [
					{
						upload_url: "", // 直接返回内容，不需要 URL
						sandbox_path: typeof path === "string" ? path : path[0],
					},
				],
			},
		],
	};
}

/**
 * 写入文件到沙盒
 */
export async function writeSandboxFile(
	sandboxId: string,
	fileList: Array<{ file: string; save_path: string }>,
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<{ result: string }> {
	const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/write`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			sandbox_id: sandboxId,
			file_list: fileList,
		}),
	});

	if (!response.ok) {
		throw new Error(`Failed to write file: ${response.statusText}`);
	}

	return response.json();
}

/**
 * 获取文件内容（下载并读取）
 */
export async function getFileContent(
	sandboxId: string,
	filePath: string,
	apiKey: string,
	baseUrl: string = "https://api.302.ai",
): Promise<string> {
	// 直接调用下载 API，它会返回文件内容
	const response = await fetch(`${baseUrl}/302/claude-code/sandbox/file/download`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			sandbox_id: sandboxId,
			path: filePath,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error("[getFileContent] Error response:", errorText);
		throw new Error(`Failed to download file: ${response.statusText}`);
	}

	const contentType = response.headers.get("content-type");
	console.log("[getFileContent] Content-Type:", contentType);

	// 如果返回的是 JSON，说明返回的是下载 URL
	if (contentType?.includes("application/json")) {
		const jsonResponse = await response.json();
		console.log("[getFileContent] JSON response:", jsonResponse);

		// 如果有 download_url，则获取文件内容
		if (jsonResponse.download_url) {
			const contentResponse = await fetch(jsonResponse.download_url);
			if (!contentResponse.ok) {
				throw new Error(`Failed to fetch file content: ${contentResponse.statusText}`);
			}
			return contentResponse.text();
		}

		throw new Error("No download URL in response");
	}

	// 否则，直接返回文本内容
	return response.text();
}
