import { API_BASE_URL } from "$lib/constants/api";

/**
 * MCP Server info from 302.AI API
 */
export interface Mcp302Server {
	name: string;
	proxyId: string;
	displayTools: string[];
}

/**
 * Response structure from 302.AI MCP servers API
 */
interface Mcp302ApiResponse {
	code: number;
	msg: string;
	data: {
		total: number;
		data: Array<{
			name: string;
			settings?: {
				proxyId?: string;
				displayTools?: string[];
			};
		}>;
		page: number;
		page_size: number;
	};
}

/**
 * Fetch MCP servers from 302.AI API
 * @param token - User's Basic authorization token
 * @returns Array of MCP server info with proxyId
 */
export async function fetch302McpServers(token: string): Promise<Mcp302Server[]> {
	try {
		const url = new URL(`${API_BASE_URL}/gpt/api/tokens`);
		url.searchParams.set("type", "mcp");
		url.searchParams.set("page", "1");
		url.searchParams.set("page_size", "100");

		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				accept: "application/json",
				authorization: token,
				isgpt: "1",
				lang: "zh-CN",
				tz: "Asia/Shanghai",
				origin: "https://302.ai",
				referer: "https://302.ai/",
			},
		});

		if (!response.ok) {
			console.error(
				`[302 MCP] API request failed: ${response.status} ${response.statusText}`,
			);
			return [];
		}

		const data: Mcp302ApiResponse = await response.json();

		if (data.code !== 0) {
			console.error(`[302 MCP] API returned error: ${data.msg}`);
			return [];
		}

		// Extract servers with valid proxyId
		const servers: Mcp302Server[] = [];
		for (const item of data.data.data) {
			const proxyId = item.settings?.proxyId;
			if (proxyId) {
				servers.push({
					name: item.name,
					proxyId,
					displayTools: item.settings?.displayTools || [],
				});
			}
		}

		console.log(`[302 MCP] Fetched ${servers.length} MCP servers from 302.AI`);
		return servers;
	} catch (error) {
		console.error("[302 MCP] Failed to fetch MCP servers:", error);
		return [];
	}
}

/**
 * Build the MCP server URL from proxyId
 * @param proxyId - The proxy ID from 302.AI
 * @returns The full MCP server URL
 */
export function buildMcpServerUrl(proxyId: string): string {
	return `https://api.302.ai/custom-mcp/mcp/${proxyId}`;
}
