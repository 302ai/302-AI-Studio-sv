import type { ModelProvider } from "@shared/types";
import { _302AIKy } from "./core/_302ai-ky";

/**
 * 302.AI Web Hosting API
 * Deploy HTML content to 302.AI hosting service
 */

export interface DeployHtmlRequest {
	html: string;
	title?: string;
	description?: string;
}

export interface DeployHtmlResponse {
	success: boolean;
	data?: {
		web_id: string;
		url: string;
		title?: string;
		created_at: string;
	};
	error?: string;
}

export interface UploadWebserveRequest {
	file: File;
	add_cover?: boolean;
	add_watermarks?: boolean;
}

export interface UploadWebserveResponse {
	success: boolean;
	data?: {
		cover: string;
		id: string;
		url: string;
	};
	error?: string;
}

/**
 * Validate 302.AI provider configuration
 */
export function validate302Provider(
	providers: ModelProvider[],
): { valid: true; provider: ModelProvider } | { valid: false; error: string } {
	const provider302 = providers.find((p) => p.apiType === "302ai");

	if (!provider302) {
		return {
			valid: false,
			error: "toast_deploy_no_302_provider",
		};
	}

	if (!provider302.enabled || !provider302.apiKey || provider302.apiKey.trim() === "") {
		return {
			valid: false,
			error: "toast_deploy_302_provider_disabled",
		};
	}

	return {
		valid: true,
		provider: provider302,
	};
}

/**
 * Extract error message from API error response
 */
function extractErrorMessage(errorData: unknown): string | null {
	if (!errorData || typeof errorData !== "object") return null;

	const data = errorData as Record<string, unknown>;

	// Handle nested error object: { error: { message: "..." } }
	if (data.error && typeof data.error === "object") {
		const errorObj = data.error as Record<string, unknown>;
		if (typeof errorObj.message === "string") return errorObj.message;
		if (typeof errorObj.message_cn === "string") return errorObj.message_cn;
	}

	// Handle direct error string: { error: "..." }
	if (typeof data.error === "string") return data.error;

	// Handle direct message: { message: "..." }
	if (typeof data.message === "string") return data.message;

	return null;
}

/**
 * Deploy HTML to 302.AI hosting service
 */
export async function deployHtmlTo302(
	provider: ModelProvider,
	request: DeployHtmlRequest,
): Promise<DeployHtmlResponse> {
	try {
		// Use the base URL without /v1 suffix
		const baseUrl = provider.baseUrl.replace(/\/v1\/?$/, "");
		const endpoint = `${baseUrl}/302/webserve/html`;

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${provider.apiKey}`,
			},
			body: JSON.stringify(request),
		});

		const data = await response.json();

		// Check for error in response body (even if status is 200)
		const errorMessage = extractErrorMessage(data);
		if (errorMessage) {
			return {
				success: false,
				error: errorMessage,
			};
		}

		if (!response.ok) {
			return {
				success: false,
				error: `API request failed: ${response.status} ${response.statusText}`,
			};
		}

		return {
			success: true,
			data: data,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to deploy HTML",
		};
	}
}

/**
 * Upload file to 302.AI webserve hosting
 */
export async function uploadToWebserve(
	provider: ModelProvider,
	request: UploadWebserveRequest,
): Promise<UploadWebserveResponse> {
	try {
		const baseUrl = provider.baseUrl.replace(/\/v1\/?$/, "");
		const endpoint = `${baseUrl}/302/webserve/upload`;

		const formData = new FormData();
		formData.append("file", request.file);
		if (request.add_watermarks !== undefined) {
			formData.append("add_watermarks", String(request.add_watermarks));
		}
		if (request.add_cover !== undefined) {
			formData.append("add_cover", String(request.add_cover));
		}

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${provider.apiKey}`,
			},
			body: formData,
		});

		const data = await response.json();

		// Check for error in response body (even if status is 200)
		const errorMessage = extractErrorMessage(data);
		if (errorMessage) {
			return {
				success: false,
				error: errorMessage,
			};
		}

		if (!response.ok) {
			return {
				success: false,
				error: `API request failed: ${response.status} ${response.statusText}`,
			};
		}

		return {
			success: true,
			data: data,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to upload file",
		};
	}
}

export interface WebserveListRequest {
	page?: number;
	limit?: number;
}

export interface WebserveListResponse {
	success: boolean;
	data?: {
		id: number;
		url: string;
		cover: string;
		status: number;
	}[];
	pagination?: {
		current_page: number;
		page_size: number;
		total_items: number;
		total_pages: number;
	};
	error?: string;
}

/**
 * Get list of deployed websites
 */
export async function getWebserveList(
	provider: ModelProvider,
	request: WebserveListRequest = {},
): Promise<WebserveListResponse> {
	try {
		const searchParams: Record<string, string> = {
			only_return_success: "true",
		};

		if (request.page) searchParams.page = String(request.page);
		if (request.limit) searchParams.limit = String(request.limit);

		const data = await _302AIKy
			.get("302/webserve/list", {
				searchParams,
			})
			.json<WebserveListResponse>();

		const errorMessage = extractErrorMessage(data);
		if (errorMessage) {
			return {
				success: false,
				error: errorMessage,
			};
		}

		return {
			success: true,
			data: data.data,
			pagination: data.pagination,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to fetch website list",
		};
	}
}

export interface DeleteWebserveResponse {
	success: boolean;
	data?: {
		deleted: string;
	};
	error?: string;
}

/**
 * Delete a deployed website
 */
export async function deleteDeployedWebsite(
	provider: ModelProvider,
	webId: string | number,
): Promise<DeleteWebserveResponse> {
	try {
		const data = await _302AIKy
			.post(`302/webserve/delete/${webId}`)
			.json<DeleteWebserveResponse>();

		const errorMessage = extractErrorMessage(data);
		if (errorMessage) {
			return {
				success: false,
				error: errorMessage,
			};
		}

		return {
			success: true,
			data: data.data,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to delete website",
		};
	}
}
