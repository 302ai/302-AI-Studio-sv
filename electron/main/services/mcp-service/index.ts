import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpServer } from "@shared/storage/mcp";
import { type IpcMainInvokeEvent } from "electron";

interface MCPClientWrapper {
	client: Client;
	transport: Transport;
}

export class McpService {
	private clients = new Map<string, MCPClientWrapper>();

	async createClient(server: McpServer): Promise<MCPClientWrapper | null> {
		try {
			let transport: Transport;

			if (server.type === "stdio") {
				if (!server.command) {
					throw new Error("stdio server requires command");
				}

				const parts = server.command.split(" ");
				const command = parts[0];
				const args = parts.slice(1);

				console.log(parts, command, args);

				transport = new StdioClientTransport({
					command,
					args,
					env: server.advancedSettings?.customEnvVars as Record<string, string> | undefined,
				});
			} else if (server.type === "sse") {
				if (!server.url) {
					throw new Error("SSE server requires URL");
				}

				const { SSEClientTransport } = await import("@modelcontextprotocol/sdk/client/sse.js");

				transport = new SSEClientTransport(new URL(server.url));
			} else if (server.type === "streamableHTTP") {
				if (!server.url) {
					throw new Error("StreamableHTTP server requires URL");
				}

				const { StreamableHTTPClientTransport } = await import(
					"@modelcontextprotocol/sdk/client/streamableHttp.js"
				);

				transport = new StreamableHTTPClientTransport(new URL(server.url), {
					sessionId: server.id,
				});
			} else {
				throw new Error(`Unsupported MCP server type: ${server.type}`);
			}

			const client = new Client(
				{
					name: "302-ai-studio",
					version: "1.0.0",
				},
				{
					capabilities: {},
				},
			);

			await client.connect(transport);

			const wrapper: MCPClientWrapper = {
				client,
				transport,
			};

			this.clients.set(server.id, wrapper);
			return wrapper;
		} catch (error) {
			console.error(`Failed to create MCP client for server ${server.name}:`, error);
			return null;
		}
	}

	async getToolsFromServer(
		_event: IpcMainInvokeEvent,
		server: McpServer,
	): Promise<{
		isOk: boolean;
		tools?: Array<{
			name: string;
			description?: string;
			inputSchema?: Record<string, unknown>;
		}>;
		error?: string;
	}> {
		try {
			let wrapper = this.clients.get(server.id);

			if (!wrapper) {
				const newWrapper = await this.createClient(server);
				if (!newWrapper) {
					return { isOk: false, error: "Failed to create MCP client" };
				}
				wrapper = newWrapper;
			}

			const result = await wrapper.client.listTools();

			const tools = result.tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
			}));

			return { isOk: true, tools };
		} catch (error) {
			console.error(`Failed to get tools from server ${server.name}:`, error);
			return { isOk: false, error: String(error) };
		}
	}

	async closeServer(
		_event: IpcMainInvokeEvent,
		serverId: string,
	): Promise<{ isOk: boolean; error?: string }> {
		try {
			const wrapper = this.clients.get(serverId);
			if (wrapper) {
				await wrapper.client.close();
				this.clients.delete(serverId);
			}
			return { isOk: true };
		} catch (error) {
			console.error(`Failed to close MCP server ${serverId}:`, error);
			return { isOk: false, error: String(error) };
		}
	}

	async closeAllServers(): Promise<void> {
		const closePromises = Array.from(this.clients.entries()).map(async ([id, wrapper]) => {
			try {
				await wrapper.client.close();
			} catch (error) {
				console.error(`Failed to close MCP server ${id}:`, error);
			}
		});

		await Promise.all(closePromises);
		this.clients.clear();
	}
}

export const mcpService = new McpService();
