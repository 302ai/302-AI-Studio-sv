export type McpServerType = "stdio" | "sse" | "streamableHTTP";

export interface McpServerAdvancedSettings {
	timeout?: number;
	customHeaders?: Record<string, unknown>;
	customEnvVars?: Record<string, unknown>;
	autoUseTool?: boolean;
	keepLongTaskConnection?: boolean;
}

export interface McpServer {
	id: string;
	name: string;
	description: string;
	type: McpServerType;
	url: string | null;
	command: string | null;
	icon: string;
	enabled: boolean;
	order: number;
	createdAt: Date;
	updatedAt: Date;
	advancedSettings?: McpServerAdvancedSettings;
}

export interface McpServerWithRelations extends McpServer {
	tools?: Array<unknown>;
	threads?: Array<unknown>;
}
