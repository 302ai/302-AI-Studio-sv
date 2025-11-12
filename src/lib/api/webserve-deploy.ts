import type { ModelProvider } from "@shared/types";

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

/**
 * Validate 302.AI provider configuration
 */
export function validate302Provider(providers: ModelProvider[]): {
	valid: boolean;
	provider?: ModelProvider;
	error?: string;
} {
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

		if (!response.ok) {
			const errorText = await response.text();
			let errorMessage = `API request failed: ${response.status} ${response.statusText}`;

			try {
				const errorData = JSON.parse(errorText);
				if (errorData.error) {
					errorMessage = errorData.error;
				} else if (errorData.message) {
					errorMessage = errorData.message;
				}
			} catch {
				// If error response is not JSON, use the text as is
				if (errorText) {
					errorMessage = errorText;
				}
			}

			return {
				success: false,
				error: errorMessage,
			};
		}

		const data = await response.json();

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
