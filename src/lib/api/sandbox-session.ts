/**
 * Sandbox Session API Client
 * 302.AI 沙盒会话 API
 */

import { createLogger } from "@shared/logger";
import {
	listLocalClaudeCodeSessionsResponse,
	type ListLocalClaudeCodeSessionsResponse,
} from "@shared/types";
import { type } from "arktype";
import { getCodeAgentKy, isLocalOrCloudMode } from "./utils";

const logger = createLogger("apis");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Strip `sandbox_id` in local mode (local sandbox doesn't use it).
 */
function buildParams<T extends { sandbox_id: string }>(params: T): Omit<T, "sandbox_id"> | T {
	if (isLocalOrCloudMode()) {
		const { sandbox_id: _, ...rest } = params;
		return rest;
	}
	return params;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UpdateSessionNoteRequest {
	/** 备注 */
	note: string;
	/** 沙盒id */
	sandbox_id: string;
	/** 对话id */
	session_id: string;
}

export interface UpdateSessionNoteResponse {
	message: string;
	note: string;
	sandbox_id: string;
	session_id: string;
	success: boolean;
}

export interface UpdateSessionNoteResult {
	success: boolean;
	data?: UpdateSessionNoteResponse;
	error?: string;
}

export interface DeleteSessionRequest {
	/** 沙盒id */
	sandbox_id: string;
	/** 对话id */
	session_id: string;
}

export interface DeleteSessionResponse {
	message: string;
	sandbox_id: string;
	session_id: string;
	success: boolean;
}

export interface DeleteSessionResult {
	success: boolean;
	data?: DeleteSessionResponse;
	error?: string;
}

// ─── Schemas (arktype) ──────────────────────────────────────────────────────

export const updateSessionNoteRequestSchema = type({
	note: "string",
	sandbox_id: "string",
	session_id: "string",
});
export type _UpdateSessionNoteRequest = typeof updateSessionNoteRequestSchema.infer;

export const updateSessionNoteResponseSchema = type({
	message: "string",
	note: "string",
	sandbox_id: "string",
	session_id: "string",
	success: "boolean",
});
export type _UpdateSessionNoteResponse = typeof updateSessionNoteResponseSchema.infer;

// ─── API Functions ──────────────────────────────────────────────────────────

/**
 * Update session note (with arktype validation).
 * Automatically adapts to local/remote mode.
 *
 * 添加/修改对话备注（带 arktype 校验）
 */
export async function updateSessionNote(
	request: UpdateSessionNoteRequest,
): Promise<UpdateSessionNoteResult> {
	try {
		const kyInstance = await getCodeAgentKy();

		const response = await kyInstance
			.post("302/claude-code/sandbox/session", {
				json: buildParams(request),
			})
			.json();

		const validated = updateSessionNoteResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate update session note response:", validated.summary);
			return {
				success: false,
				error: "Invalid response format from update session note API",
			};
		}

		if (validated.success === false) {
			return {
				success: false,
				error: validated.message || "Failed to update session note",
			};
		}

		return { success: true, data: validated };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to update session note",
		};
	}
}

/**
 * Delete a session (state-dependent: remote or local based on codeAgentState.type).
 * Used by code that works in both modes (e.g. remote sandbox state store).
 *
 * 删除对话（根据全局状态自动适配 local/remote）
 */
export async function deleteSession(request: DeleteSessionRequest): Promise<DeleteSessionResult> {
	try {
		const kyInstance = await getCodeAgentKy();

		const searchParams = buildParams({
			sandbox_id: request.sandbox_id,
			session_id: request.session_id,
		});

		const data = (await kyInstance
			.delete("302/claude-code/sandbox/session", { searchParams })
			.json()) as DeleteSessionResponse;

		if (data.success === false) {
			return {
				success: false,
				error: data.message || "Failed to delete session",
			};
		}

		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to delete session",
		};
	}
}

/**
 * Delete a local session (always uses local ky instance, no global state dependency).
 * Used by local-specific code paths.
 *
 * 删除本地对话（始终使用本地 ky 实例，不依赖全局状态）
 */
export async function deleteLocalSession(sessionId: string): Promise<DeleteSessionResult> {
	try {
		const kyInstance = await getCodeAgentKy();

		const data = (await kyInstance
			.delete("302/claude-code/sandbox/session", {
				searchParams: { session_id: sessionId },
			})
			.json()) as DeleteSessionResponse;

		if (data.success === false) {
			return {
				success: false,
				error: data.message || "Failed to delete session",
			};
		}

		return { success: true, data };
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Failed to delete session",
		};
	}
}

/**
 * List local sessions (always uses local ky instance, no global state dependency).
 *
 * 列出本地会话（始终使用本地 ky 实例）
 */
export async function listLocalSessions(): Promise<ListLocalClaudeCodeSessionsResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const response = await kyInstance.get("302/claude-code/sandbox/session").json();

		const validated = listLocalClaudeCodeSessionsResponse(response);
		if (validated instanceof type.errors) {
			logger.error(
				"Failed to validate list local claude code sessions response:",
				validated.summary,
			);
			throw new Error("Invalid response format from list local claude code sessions API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to list local claude code sessions:", error);
		throw error;
	}
}
