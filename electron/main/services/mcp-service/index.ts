import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { McpServer } from "@shared/storage/mcp";
import { experimental_createMCPClient as createMCPClient } from "ai";
import { type IpcMainInvokeEvent } from "electron";

interface MCPClientWrapper {
	mcpClient: Awaited<ReturnType<typeof createMCPClient>>;
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

				console.log("[MCP] Creating stdio transport:", { command, args });
				console.log("[MCP] Current PATH:", process.env.PATH);

				const envVars = {
					...(server.advancedSettings?.customEnvVars as Record<string, string> | undefined),
				};

				if (!envVars.PATH && process.env.PATH) {
					envVars.PATH = process.env.PATH;
				}

				transport = new StdioClientTransport({
					command,
					args,
					env: envVars,
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

			const mcpClient = await createMCPClient({ transport });

			const wrapper: MCPClientWrapper = {
				mcpClient,
				transport,
			};

			this.clients.set(server.id, wrapper);
			return wrapper;
		} catch (error) {
			console.error(`[MCP] Failed to create MCP client for server ${server.name}:`, error);

			if (
				error instanceof Error &&
				(error.message.includes("ENOENT") || error.message.includes("command not found"))
			) {
				console.error(
					`[MCP] Command not found: ${server.command}. This may be due to PATH issues.`,
				);
				console.error(`[MCP] Current PATH: ${process.env.PATH}`);
				console.error("[MCP] If launching via double-click, ensure fix-path is loaded at startup.");
			}

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

			const toolsObject = await wrapper.mcpClient.tools();
			const tools = Object.entries(toolsObject).map(([name, _tool]) => {
				// Try to serialize the inputSchema
				let inputSchema: Record<string, unknown> = {};
				if (_tool.inputSchema) {
					try {
						// FlexibleSchema might have a jsonSchema property or be directly serializable
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						const schema = _tool.inputSchema as any;

						// Check if it has a jsonSchema property (common in AI SDK)
						if (schema.jsonSchema) {
							inputSchema = schema.jsonSchema;
						} else if (schema._def?.jsonSchema) {
							inputSchema = schema._def.jsonSchema;
						} else {
							// Try direct serialization as fallback
							inputSchema = JSON.parse(JSON.stringify(_tool.inputSchema));
						}

						// If the result still has a jsonSchema property, unwrap it
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						if (inputSchema && (inputSchema as any).jsonSchema) {
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							inputSchema = (inputSchema as any).jsonSchema;
						}
					} catch (error) {
						console.warn(`Failed to serialize inputSchema for tool ${name}:`, error);
						inputSchema = {};
					}
				}

				return {
					name,
					description: _tool.description || "",
					inputSchema,
				};
			});

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
				await wrapper.mcpClient.close();
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
				await wrapper.mcpClient.close();
			} catch (error) {
				console.error(`Failed to close MCP server ${id}:`, error);
			}
		});

		await Promise.all(closePromises);
		this.clients.clear();
	}

	async getClient(
		serverId: string,
		server: McpServer,
	): Promise<Awaited<ReturnType<typeof createMCPClient>> | null> {
		let wrapper = this.clients.get(serverId);

		if (!wrapper) {
			const newWrapper = await this.createClient(server);
			if (!newWrapper) {
				return null;
			}
			wrapper = newWrapper;
		}

		return wrapper.mcpClient;
	}

	async getToolsFromServerIds(serverIds: string[], allServers: McpServer[]) {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const allTools: Record<string, any> = {};

		for (const serverId of serverIds) {
			const server = allServers.find((s) => s.id === serverId);
			if (!server || !server.enabled) {
				continue;
			}

			const mcpClient = await this.getClient(serverId, server);
			if (!mcpClient) {
				console.error(`Failed to get MCP client for server ${server.name}`);
				continue;
			}

			try {
				const tools = await mcpClient.tools();
				// Add server ID prefix to each tool name to track which server it belongs to
				for (const [toolName, toolDef] of Object.entries(tools)) {
					const prefixedName = `${serverId}__${toolName}`;
					allTools[prefixedName] = toolDef;
				}
			} catch (error) {
				console.error(`Failed to get tools from server ${server.name}:`, error);
			}
		}

		return allTools;
	}
}

export const mcpService = new McpService();
