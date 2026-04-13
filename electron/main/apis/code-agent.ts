import { createLogger } from "@shared/logger";
import {
	createClaudeCodeSandboxResponse,
	skill,
	type CodeAgentType,
	type CreateClaudeCodeSandboxRequest,
	type CreateClaudeCodeSandboxResponse,
	type Skill,
} from "@shared/storage/code-agent";
import { type } from "arktype";
import JSZip from "jszip";
import ky from "ky";
import { _302AIKy } from "./core/_302ai-ky";
import { localCodeAgentKy } from "./core/code-agent-ky";
import { getCodeAgentKyByMode, getCodeAgentKyBySandboxId } from "./utils";

const logger = createLogger("apis");

export const sessionInfoSchema = type({
	session_id: "string",
	workspace_path: "string",
	note: "string",
	used_at: "string",
	updated_at: "string",
});
export type SessionInfo = typeof sessionInfoSchema.infer;

/**
 * Create a claude code sandbox
 * @param llm_model - The llm model to use
 * @returns The created claude code sandbox
 */
export async function createClaudeCodeSandbox(
	request: CreateClaudeCodeSandboxRequest,
): Promise<CreateClaudeCodeSandboxResponse> {
	try {
		logger.debug("request", request);
		const response = await _302AIKy
			.post("302/claude-code/sandbox/create", {
				json: {
					...request,
					auto_pause_seconds: 30,
				},
			})
			.json();

		logger.debug("createClaudeCodeSandbox response:", response);

		const validated = createClaudeCodeSandboxResponse(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate create claude code sandbox:", validated.summary);
			throw new Error("Invalid response format from create claude code sandbox API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to create claude code sandbox:", error);
		throw error;
	}
}

const updateClaudeCodeSandboxResponse = type({
	success: "boolean",
	data: {
		sandbox_id: "string",
	},
});
export type UpdateClaudeCodeSandboxResponse = typeof updateClaudeCodeSandboxResponse.infer;

/**
 * Update a claude code sandbox
 * @param sandbox_id - The sandbox id to update
 * @param llm_model - The llm model to use
 * @returns The updated claude code sandbox
 */
export async function updateClaudeCodeSandbox(
	sandbox_id: string,
	llm_model?: string,
	sandbox_name?: string,
	max_thinking_token?: number,
): Promise<UpdateClaudeCodeSandboxResponse> {
	try {
		const kyInstance = getCodeAgentKyBySandboxId(sandbox_id);
		const response = await kyInstance
			.post("302/claude-code/sandbox/reset", {
				json: {
					sandbox_id,
					llm_model,
					sandbox_name,
					max_thinking_token,
					auto_pause_seconds: 30,
				},
			})
			.json();

		logger.debug("[updateClaudeCodeSandbox] response:", response);

		const validated = updateClaudeCodeSandboxResponse(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate update claude code sandbox:", validated.summary);
			throw new Error("Invalid response format from update claude code sandbox API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to update claude code sandbox:", error);
		throw error;
	}
}

const deleteClaudeCodeSandboxResponse = type({
	success: "boolean",
});
export type DeleteClaudeCodeSandboxResponse = typeof deleteClaudeCodeSandboxResponse.infer;

/**
 * Delete a claude code sandbox
 * @param sandbox_id - The sandbox id to delete
 * @returns The response from deleting the claude code sandbox
 */
export async function deleteClaudeCodeSandbox(
	sandbox_id: string,
): Promise<DeleteClaudeCodeSandboxResponse> {
	try {
		const response = await _302AIKy
			.post("302/claude-code/sandbox/delete", {
				json: { sandbox_id },
			})
			.json();

		logger.debug("deleteClaudeCodeSandbox response:", response);

		const validated = deleteClaudeCodeSandboxResponse(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate delete claude code sandbox:", validated.summary);
			throw new Error("Invalid response format from delete claude code sandbox API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to delete claude code sandbox:", error);
		throw error;
	}
}

const sandboxInfoSchema = type({
	sandbox_id: "string",
	sandbox_name: "string",
	status: "'killed' | 'running' | 'paused'",
	llm_model: "string",
	created_at: "string",
	updated_at: "string",
	deleted_at: "string",
	max_thinking_token: "number",
	disk_used: "number",
	disk_total: "number",
	session_num: "number",
	session_list: sessionInfoSchema.array(),
});
export type SandboxInfo = typeof sandboxInfoSchema.infer;
export const listClaudeCodeSandboxesResponse = type({
	success: "boolean",
	pagination: {
		current_page: "number",
		page_size: "number",
		total_items: "number",
		total_pages: "number",
	},
	list: sandboxInfoSchema.array(),
});
export type ListClaudeCodeSandboxesResponse = typeof listClaudeCodeSandboxesResponse.infer;

/**
 * List all claude code sandboxes
 * @returns The list of claude code sandboxes
 */
export async function listClaudeCodeSandboxes(
	apiKey?: string,
): Promise<ListClaudeCodeSandboxesResponse> {
	try {
		const response =
			apiKey && apiKey.trim() !== ""
				? await ky
						.get("https://api.302.ai/302/claude-code/sandbox/list", {
							headers: {
								Authorization: `Bearer ${apiKey}`,
							},
						})
						.json()
				: await _302AIKy.get("302/claude-code/sandbox/list").json();

		const validated = listClaudeCodeSandboxesResponse(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate list claude code sandboxes:", validated.summary);
			throw new Error("Invalid response format from list claude code sandboxes API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to list claude code sandboxes:", error);
		throw error;
	}
}

export const listClaudeCodeSessionsResponse = type({
	success: "boolean",
	sandbox_id: "string",
	session_list: sessionInfoSchema.array(),
});
export type ListClaudeCodeSessionsResponse = typeof listClaudeCodeSessionsResponse.infer;

/**
 * List all claude code sessions
 * @param sandbox_id - The sandbox id to list sessions for
 * @returns The list of claude code sessions
 */
export async function listClaudeCodeSessions(
	sandbox_id: string,
): Promise<ListClaudeCodeSessionsResponse> {
	try {
		const response = await _302AIKy
			.get(`302/claude-code/sandbox/session?sandbox_id=${sandbox_id}`)
			.json();

		const validated = listClaudeCodeSessionsResponse(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate list claude code sessions:", validated.summary);
			throw new Error("Invalid response format from list claude code sessions API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to list claude code sessions:", error);
		throw error;
	}
}

export const addMcpSchemaResponse = type({
	success: "boolean",
	message: "string",
	sandbox_id: "string",
});
export type AddMcpSchema = typeof addMcpSchemaResponse.infer;

/**
 * Add MCP servers to a claude code sandbox
 * @param sandboxId - The sandbox id to add MCP servers to
 * @param mcpServerUrls - The MCP server URLs to add
 * @returns The result of adding the MCP servers
 */
export async function addClaudeCodeSandboxMCP(
	sandboxId: string,
	MCPInfos: { url: string; name: string }[],
	mode: CodeAgentType,
): Promise<AddMcpSchema> {
	const commands = MCPInfos.map(
		(info) => `claude mcp add --transport http ${info.name} ${info.url}`,
	);
	try {
		const response = await getCodeAgentKyByMode(mode)
			.post("302/claude-code/sandbox/mcp/add", {
				json: { sandbox_id: sandboxId, mcp_servers: commands },
			})
			.json();

		const validated = addMcpSchemaResponse(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate add claude code MCP response:", validated.summary);
			throw new Error("Invalid response format from add claude code MCP API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to add claude code MCP:", error);
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
	mode: CodeAgentType,
): Promise<BatchUploadFileResponse> {
	const response = await getCodeAgentKyByMode(mode)
		.post("302/claude-code/sandbox/file/upload/batch", {
			json: request,
			timeout: 300000,
		})
		.json();

	logger.debug("[batchUploadFile] Raw response:", JSON.stringify(response, null, 2));

	const validated = batchUploadFileResponseSchema(response);
	if (validated instanceof type.errors) {
		logger.error("Failed to validate batch upload file response:", validated.summary);
		throw new Error("Invalid response format from batch upload file API");
	}
	return validated;
}

// Skill Details API
export const skillDetailsResponseSchema = type({
	success: "boolean",
	skill: skill,
});
export type SkillDetailsResponse = typeof skillDetailsResponseSchema.infer;

/**
 * Get skill details including content
 * @param skillName - The name of the skill
 * @param builtin - Whether the skill is a builtin skill
 * @returns The skill details with content
 */
export async function getSkillDetails(
	skillName: string,
	builtin: boolean = false,
): Promise<Skill | null> {
	try {
		logger.debug(`[getSkillDetails] Fetching skill: ${skillName}, builtin: ${builtin}`);
		const response = await _302AIKy
			.get("302/claude-code/skills/detail", {
				searchParams: {
					name: skillName,
					mode: "view",
					builtin,
				},
			})
			.json();

		logger.debug(`[getSkillDetails] Response:`, JSON.stringify(response, null, 2));

		const validated = skillDetailsResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate skill details response:", validated.summary);
			return null;
		}
		logger.info(
			`[getSkillDetails] Skill content length: ${validated.skill.content?.length ?? 0}`,
		);
		return validated.skill;
	} catch (error) {
		logger.error("Failed to get skill details:", error);
		return null;
	}
}

/**
 * Get skill content by downloading the skill zip and extracting SKILL.md
 * This is used when the view API doesn't return content
 * @param skillName - The name of the skill
 * @param builtin - Whether the skill is a builtin skill
 * @returns The skill content (SKILL.md) or null if failed
 */
export async function getSkillContent(
	skillName: string,
	builtin: boolean = false,
): Promise<string | null> {
	try {
		logger.debug(`[getSkillContent] Fetching skill zip: ${skillName}, builtin: ${builtin}`);

		// Use edit mode to get the zip file
		const response = await _302AIKy.get("302/claude-code/skills/detail", {
			searchParams: {
				name: skillName,
				mode: "edit",
				builtin,
			},
		});

		const blob = await response.blob();
		logger.debug(`[getSkillContent] Got zip blob, size: ${blob.size}`);

		// Extract SKILL.md from the zip
		const zip = await JSZip.loadAsync(await blob.arrayBuffer());

		// Look for SKILL.md in the zip (could be at root or in a folder)
		let skillMdContent: string | null = null;

		for (const [path, file] of Object.entries(zip.files)) {
			if (path.endsWith("SKILL.md") && !file.dir) {
				skillMdContent = await file.async("string");
				logger.info(
					`[getSkillContent] Found SKILL.md at: ${path}, length: ${skillMdContent.length}`,
				);
				break;
			}
		}

		if (!skillMdContent) {
			logger.warn(`[getSkillContent] SKILL.md not found in zip for skill: ${skillName}`);
		}

		return skillMdContent;
	} catch (error) {
		logger.error(`[getSkillContent] Failed to get skill content for ${skillName}:`, error);
		return null;
	}
}

export const localSandboxHealthResponseSchema = type({
	success: "boolean",
	status: "string",
	"oc_status?": "string",
});
export type LocalSandboxHealthResponse = typeof localSandboxHealthResponseSchema.infer;

export async function getLocalSandboxHealthStatus(): Promise<LocalSandboxHealthResponse> {
	try {
		const response = await localCodeAgentKy.get("302/claude-code/sandbox/health").json();
		logger.debug("[getLocalSandboxHealthStatus] Health check response:", response);
		const validated = localSandboxHealthResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate health check response:", validated.summary);
			throw new Error(`Invalid health check response: ${validated.summary}`);
		}
		return validated;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const lowerMsg = errorMessage.toLowerCase();
		const isExpectedConnectionError =
			lowerMsg.includes("fetch failed") ||
			lowerMsg.includes("failed to fetch") ||
			lowerMsg.includes("econnrefused") ||
			lowerMsg.includes("connection refused") ||
			lowerMsg.includes("etimedout") ||
			lowerMsg.includes("timed out");

		if (!isExpectedConnectionError) {
			logger.error("[getLocalSandboxHealthStatus] Health check failed:", error);
		}
		throw error;
	}
}
