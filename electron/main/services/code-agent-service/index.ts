import {
	addClaudeCodeSandboxMCP,
	createClaudeCodeSandbox,
	deleteClaudeCodeSandbox,
	listClaudeCodeSandboxes,
	listClaudeCodeSessions,
	updateClaudeCodeSandbox,
} from "@electron/main/apis/code-agent";
import { createLogger } from "@shared/logger";
import type {
	CodeAgentConfigMetadata,
	CodeAgentCreateResult,
	CreateClaudeCodeSandboxRequest,
} from "@shared/storage/code-agent";
import type { ThreadParmas } from "@shared/types";
import type { IpcMainInvokeEvent } from "electron";
import fs from "fs";
import path from "path";
import { getRuntimeComposeDir } from "../../utils/local-vibe-utils";
import { emitter } from "../broadcast-service";
import { storageService } from "../storage-service";
import {
	claudeCodeSandboxStorage,
	claudeCodeStorage,
	codeAgentStorage,
} from "../storage-service/code-agent";

const logger = createLogger("services");

export class CodeAgentService {
	constructor() {
		this._updateClaudeCodeSandboxes();

		emitter.on("provider:302ai-provider-changed", ({ apiKey }) => {
			this._updateClaudeCodeSandboxes(apiKey);
		});
	}

	private calculateDiskUsage(diskTotal: number, diskUsed: number): "normal" | "insufficient" {
		if (diskTotal === -1 || diskUsed === -1) return "normal";
		const availablePercentage = ((diskTotal - diskUsed) / diskTotal) * 100;
		return availablePercentage > 10 ? "normal" : "insufficient";
	}

	private async cleanupThreadsForSandbox(sandboxId: string): Promise<void> {
		try {
			const keys = await claudeCodeStorage.getKeysInternal();
			for (const key of keys) {
				if (key.startsWith("claude-code-agent-state-")) {
					const threadId = key
						.replace("claude-code-agent-state-", "")
						.replace(".json", "");
					const state = await claudeCodeStorage.getItemInternal(key);
					if (state && state.sandboxId === sandboxId) {
						const configKey = `code-agent-config-state-${threadId}`;
						const config = await codeAgentStorage.getItemInternal(configKey);
						if (config) {
							config.isDeleted = true;
							await codeAgentStorage.setItemInternal(configKey, config);
						}
					}
				}
			}
		} catch (error) {
			logger.error("Error cleaning up threads for sandbox:", error);
		}
	}

	private async cleanupThreadsForSession(sandboxId: string, sessionId: string): Promise<void> {
		try {
			const keys = await claudeCodeStorage.getKeysInternal();
			for (const key of keys) {
				if (key.startsWith("claude-code-agent-state-")) {
					const threadId = key
						.replace("claude-code-agent-state-", "")
						.replace(".json", "");
					const state = await claudeCodeStorage.getItemInternal(key);
					if (
						state &&
						state.sandboxId === sandboxId &&
						state.currentSessionId === sessionId
					) {
						const configKey = `code-agent-config-state-${threadId}`;
						const config = await codeAgentStorage.getItemInternal(configKey);
						if (config) {
							config.isDeleted = true;
							await codeAgentStorage.setItemInternal(configKey, config);
						}
					}
				}
			}
		} catch (error) {
			logger.error("Error cleaning up threads for session:", error);
		}
	}

	private async _updateClaudeCodeSandboxes(apiKey?: string): Promise<void> {
		try {
			const response = await listClaudeCodeSandboxes(apiKey);
			if (response.success) {
				const validList = response.list.filter((sandbox) => sandbox.status !== "killed");

				const list = validList.map((sandbox) => {
					const diskUsage = this.calculateDiskUsage(
						sandbox.disk_total,
						sandbox.disk_used,
					);

					return {
						sandboxId: sandbox.sandbox_id,
						sandboxRemark: sandbox.sandbox_name,
						diskTotal: sandbox.disk_total,
						diskUsed: sandbox.disk_used,
						diskUsage: diskUsage as "normal" | "insufficient",
						status: sandbox.status,
						llmModel: sandbox.llm_model,
						createdAt: sandbox.created_at,
						updatedAt: sandbox.updated_at,
						deletedAt: sandbox.deleted_at,
						sessionInfos: sandbox.session_list.map((session) => ({
							sessionId: session.session_id,
							workspacePath: session.workspace_path,
							note: session.note,
							usedAt: session.used_at,
							updatedAt: session.updated_at,
						})),
					};
				});

				await claudeCodeSandboxStorage.setClaudeCodeSandboxes(list);

				logger.info("Updated Claude code sandboxes, count: ", list.length);
			}
		} catch (error) {
			logger.error("Error listing Claude code sandboxes:", error);
			await claudeCodeSandboxStorage.setClaudeCodeSandboxes([]);
		}
	}

	private async _createClaudeCodeSandbox(
		threadId: string,
		sandboxCfg: CreateClaudeCodeSandboxRequest,
	): Promise<{ createdResult: CodeAgentCreateResult; sandboxId: string }> {
		const response = await createClaudeCodeSandbox(sandboxCfg);
		if (response.success) {
			const { sandbox_id: sandboxId, sandbox_name: sandboxRemark } = response.data;

			await claudeCodeStorage.setClaudeCodeSandboxInfo(threadId, sandboxId, sandboxRemark);

			return { createdResult: "success", sandboxId };
		}
		return { createdResult: "failed", sandboxId: "" };
	}

	async updateClaudeCodeSandboxes(): Promise<void> {
		await this._updateClaudeCodeSandboxes();
	}

	async removeCodeAgentState(threadId: string): Promise<void> {
		await codeAgentStorage.removeCodeAgentState(threadId);
	}

	async getClaudeCodeSandboxId(threadId: string): Promise<{ isOK: boolean; sandboxId: string }> {
		const { isOK, sandboxId } = await claudeCodeStorage.getClaudeCodeSandboxId(threadId);
		return { isOK, sandboxId };
	}

	async getCodeAgentConfig(
		threadId: string,
	): Promise<{ isOK: boolean; data: CodeAgentConfigMetadata }> {
		const { isOK, data } = await codeAgentStorage.getCodeAgentConfig(threadId);
		return { isOK, data };
	}

	// ******************************* IPC Methods ******************************* //

	async updateClaudeCodeSandboxModel(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sandbox_id: string,
		llm_model: string,
	): Promise<{ isOK: boolean; llm_model: string }> {
		try {
			const response = await updateClaudeCodeSandbox(sandbox_id, llm_model);
			if (response.success) {
				await claudeCodeStorage.setClaudeCodeModel(threadId, llm_model);
				return { isOK: true, llm_model };
			}
			return { isOK: false, llm_model: "" };
		} catch (error) {
			logger.error("Error updating Claude code sandbox:", error);
			return { isOK: false, llm_model: "" };
		}
	}

	async checkClaudeCodeSandbox(
		_event: IpcMainInvokeEvent,
		sandboxId: string,
	): Promise<{
		isOK: boolean;
		valid: boolean;
		sandboxInfo?: {
			sandboxId: string;
			sandboxRemark: string;
			llmModel: string;
			diskUsage: "normal" | "insufficient";
		};
	}> {
		try {
			const { isOK, sandboxes } = await claudeCodeSandboxStorage.getClaudeCodeSandboxes();
			if (!isOK) {
				return { isOK: false, valid: false };
			}
			const sandbox = sandboxes.find((sandbox) => sandbox.sandboxId === sandboxId);
			if (!sandbox) {
				return { isOK: true, valid: false };
			}
			return {
				isOK: true,
				valid: true,
				sandboxInfo: {
					sandboxId,
					sandboxRemark: sandbox.sandboxRemark,
					llmModel: sandbox.llmModel,
					diskUsage: sandbox.diskUsage,
				},
			};
		} catch (error) {
			logger.error("Error checking Claude code sandbox:", error);
			return { isOK: false, valid: false };
		}
	}

	async updateClaudeCodeSandboxesByIpc(_event: IpcMainInvokeEvent): Promise<{ isOK: boolean }> {
		try {
			await this.updateClaudeCodeSandboxes();
			return { isOK: true };
		} catch (error) {
			logger.error("Error updating Claude code sandboxes:", error);
			return { isOK: false };
		}
	}

	async updateClaudeCodeSessions(
		_event: IpcMainInvokeEvent,
		sandboxId: string,
	): Promise<{ isOK: boolean }> {
		try {
			const { success, session_list } = await listClaudeCodeSessions(sandboxId);
			if (!success) {
				return { isOK: false };
			}
			const list = session_list.map((session) => ({
				sessionId: session.session_id,
				workspacePath: session.workspace_path,
				note: session.note ?? "",
				usedAt: session.used_at ?? "",
			}));
			await claudeCodeSandboxStorage.setClaudeCodeSessions(sandboxId, list);
			return { isOK: true };
		} catch (error) {
			logger.error("Error updating Claude code sessions:", error);
			return { isOK: false };
		}
	}

	async updateClaudeCodeCurrentSessionIdByThreadId(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sessionId: string,
	): Promise<{ isOK: boolean }> {
		try {
			await claudeCodeStorage.updateClaudeCodeCurrentSessionIdByThreadId(threadId, sessionId);
			return { isOK: true };
		} catch (error) {
			logger.error("Error updating Claude code sessions:", error);
			return { isOK: false };
		}
	}

	async updateClaudeCodeSandboxRemark(
		_event: IpcMainInvokeEvent,
		sandbox_id: string,
		remark: string,
	): Promise<{ isOK: boolean; remark: string }> {
		try {
			const response = await updateClaudeCodeSandbox(sandbox_id, undefined, remark);
			if (response.success) {
				return { isOK: true, remark };
			}
			return { isOK: false, remark: "" };
		} catch (error) {
			logger.error("Error updating Claude code sandbox:", error);
			return { isOK: false, remark: "" };
		}
	}

	async updateClaudeCodeSandboxThinkingBudget(
		_event: IpcMainInvokeEvent,
		sandbox_id: string,
		maxThinkingToken: number,
	): Promise<{ isOK: boolean }> {
		try {
			const response = await updateClaudeCodeSandbox(
				sandbox_id,
				undefined,
				undefined,
				maxThinkingToken,
			);
			return { isOK: response.success };
		} catch (error) {
			logger.error("Error updating Claude code sandbox thinking budget:", error);
			return { isOK: false };
		}
	}

	async createClaudeCodeSandboxByIpc(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sandboxName: string,
		maxThinkingToken?: number,
	): Promise<{ isOK: boolean; sandboxId: string }> {
		try {
			const targetThread = await storageService.getItemInternal("app-thread:" + threadId);
			if (!targetThread) {
				return { isOK: false, sandboxId: "" };
			}
			const llmModel =
				(targetThread as ThreadParmas).selectedModel?.id ?? "claude-sonnet-4-5-20250929";
			const cfg: CreateClaudeCodeSandboxRequest = {
				llm_model: llmModel,
				sandbox_name: sandboxName,
				max_thinking_token: maxThinkingToken,
			};

			const { createdResult, sandboxId } = await this._createClaudeCodeSandbox(threadId, cfg);
			const isOK = createdResult === "success";
			if (isOK) {
				await claudeCodeSandboxStorage.addSandbox(sandboxId, sandboxName, llmModel);
			}
			return { isOK, sandboxId };
		} catch (error) {
			logger.error("Error creating Claude code sandbox:", error);
			return { isOK: false, sandboxId: "" };
		}
	}

	async deleteClaudeCodeSandboxByIpc(
		_event: IpcMainInvokeEvent,
		sandbox_id: string,
	): Promise<{ isOK: boolean; error?: string }> {
		try {
			const response = await deleteClaudeCodeSandbox(sandbox_id);
			if (response.success) {
				await this.updateClaudeCodeSandboxes();
				await this.cleanupThreadsForSandbox(sandbox_id);
				return { isOK: true };
			}
			return { isOK: false };
		} catch (error) {
			return { isOK: false, error: error instanceof Error ? error.message : "Unknown error" };
		}
	}

	async deleteClaudeCodeSession(
		_event: IpcMainInvokeEvent,
		sandbox_id: string,
		session_id: string,
	): Promise<{ isOK: boolean }> {
		try {
			await this.cleanupThreadsForSession(sandbox_id, session_id);
			return { isOK: true };
		} catch (error) {
			logger.error("Error deleting Claude code session:", error);
			return { isOK: false };
		}
	}

	async findClaudeCodeSandboxWithValidDisk(
		_event: IpcMainInvokeEvent,
		threadId: string,
	): Promise<{
		isOK: boolean;
		sandboxInfo?: {
			sandboxId: string;
			sandboxRemark: string;
			llmModel: string;
			diskUsage: "normal" | "insufficient";
		};
	}> {
		const { isOK, sandboxes } = await claudeCodeSandboxStorage.getClaudeCodeSandboxes();
		if (!isOK) return { isOK: false };

		const normalSandboxes = sandboxes.filter((sandbox) => sandbox.diskUsage === "normal");
		if (normalSandboxes.length > 0) {
			const randomSandbox =
				normalSandboxes[Math.floor(Math.random() * normalSandboxes.length)];
			return {
				isOK: true,
				sandboxInfo: {
					sandboxId: randomSandbox.sandboxId,
					sandboxRemark: randomSandbox.sandboxRemark,
					llmModel: randomSandbox.llmModel,
					diskUsage: "normal",
				},
			};
		}

		const targetThread = await storageService.getItemInternal("app-thread:" + threadId);
		if (!targetThread) {
			return { isOK: false };
		}
		const llmModel =
			(targetThread as ThreadParmas).selectedModel?.id ?? "claude-sonnet-4-5-20250929";
		const { createdResult, sandboxId } = await this._createClaudeCodeSandbox(threadId, {
			llm_model: llmModel,
		});

		if (createdResult === "success" && sandboxId) {
			await claudeCodeSandboxStorage.addSandbox(sandboxId, "", llmModel);

			return {
				isOK: true,
				sandboxInfo: {
					sandboxId,
					sandboxRemark: "",
					llmModel,
					diskUsage: "normal",
				},
			};
		}

		return { isOK: false };
	}

	async addClaudeCodeSandboxMCP(
		_event: IpcMainInvokeEvent,
		sandboxId: string,
		MCPInfos: { url: string; name: string }[],
		mode: string,
	): Promise<{ isOK: boolean }> {
		try {
			const result = await addClaudeCodeSandboxMCP(sandboxId, MCPInfos, mode);
			return { isOK: result.success };
		} catch (error) {
			logger.error("Error adding Claude code sandbox MCP:", error);
			return { isOK: false };
		}
	}

	/**
	 * Create a code agent state entry for a new thread, linking it to an existing sandbox and session.
	 * This is used when opening a session from settings that has no local thread data.
	 * This method creates the complete thread setup including thread data, code agent config and state.
	 */
	async createThreadForSession(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sandboxId: string,
		sessionId: string,
		sandboxRemark: string,
		llmModel: string,
		sessionNote?: string,
		workspacePath?: string,
	): Promise<{ isOK: boolean }> {
		try {
			const effectiveWorkspacePath = workspacePath || "";
			const effectiveNote = sessionNote;

			// First check if thread data already exists
			const existingThread = await storageService.getItemInternal("app-thread:" + threadId);

			// If thread data doesn't exist, create it
			if (!existingThread) {
				const threadTitle = effectiveNote || sandboxRemark || "Code Agent";
				const newThread = {
					id: threadId,
					title: threadTitle,

					temperature: null,
					topP: null,
					frequencyPenalty: null,
					presencePenalty: null,
					maxTokens: null,
					inputValue: "",
					attachments: [],
					mcpServers: [],
					mcpServerIds: [],
					isThinkingActive: false,
					isOnlineSearchActive: false,
					isMCPActive: false,
					selectedModel: {
						id: llmModel,
						name: llmModel,
						providerId: "302AI",
						type: "chat",
					},
					isPrivateChatActive: false,
					updatedAt: new Date(),
				};
				await storageService.setItemInternal("app-thread:" + threadId, newThread);

				const initialMessage = {
					id: crypto.randomUUID(),
					role: "system",
					content: "",
					createdAt: new Date(),
					parts: [],
				};
				await storageService.setItemInternal("app-chat-messages:" + threadId, [
					initialMessage,
				]);

				const { threadStorage } = await import("../storage-service/thread-storage");
				await threadStorage.addThread(threadId);

				logger.info("Created thread data for:", threadId);
			}

			const stateKey = `claude-code-agent-state-${threadId}`;
			const state = {
				sandboxId,
				sandboxRemark,
				currentSessionId: sessionId,
				model: llmModel,
				isManualNote: false,
				currentWorkspacePath: effectiveWorkspacePath,
				variables: [],
				skills: [],
				thinkingBudget: "medium" as const,
				inPlanMode: false,
			};
			await claudeCodeStorage.setItemInternal(stateKey, state);

			// Also create the code agent config to enable code agent mode
			const configKey = `code-agent-config-state-${threadId}`;
			const config: CodeAgentConfigMetadata = {
				enabled: true,
				threadId,
				type: "remote" as const, // Remote = Claude Code sandbox
				currentAgentId: "claude-code",
				codingAgentId: "claude-code",
				isDeleted: false,
			};
			await codeAgentStorage.setItemInternal(configKey, config);

			logger.info("Created complete setup for thread:", threadId);
			return { isOK: true };
		} catch (error) {
			logger.error("Error creating thread for session:", error);
			return { isOK: false };
		}
	}

	async getThreadIdBySessionId(
		_event: IpcMainInvokeEvent,
		sandboxId: string,
		sessionId: string,
	): Promise<{ isOK: boolean; threadId: string }> {
		try {
			const keys = await claudeCodeStorage.getKeysInternal();
			for (const key of keys) {
				if (key.startsWith("claude-code-agent-state-")) {
					const threadId = key
						.replace("claude-code-agent-state-", "")
						.replace(".json", "");
					const state = await claudeCodeStorage.getItemInternal(key);
					if (
						state &&
						state.sandboxId === sandboxId &&
						state.currentSessionId === sessionId
					) {
						return { isOK: true, threadId };
					}
				}
			}
			return { isOK: false, threadId: "" };
		} catch (error) {
			logger.error("Error finding thread by session:", error);
			return { isOK: false, threadId: "" };
		}
	}

	/**
	 * Set isManualNote flag for all threads that use the specified sandbox and session.
	 * This is called when user manually edits session note from settings dialog.
	 */
	async setIsManualNoteBySession(
		_event: IpcMainInvokeEvent,
		sandboxId: string,
		sessionId: string,
		isManualNote: boolean,
	): Promise<{ isOK: boolean; updatedCount: number }> {
		try {
			const keys = await claudeCodeStorage.getKeysInternal();
			let updatedCount = 0;

			for (const key of keys) {
				if (key.startsWith("claude-code-agent-state-")) {
					const state = await claudeCodeStorage.getItemInternal(key);
					if (
						state &&
						state.sandboxId === sandboxId &&
						state.currentSessionId === sessionId
					) {
						state.isManualNote = isManualNote;
						await claudeCodeStorage.setItemInternal(key, state);
						updatedCount++;
					}
				}
			}

			return { isOK: true, updatedCount };
		} catch (error) {
			logger.error("Error setting isManualNote by session:", error);
			return { isOK: false, updatedCount: 0 };
		}
	}

	/**
	 * Delete a specific workspace directory via IPC
	 * @param subPath - subdirectory name under workspace (e.g. "icr6cz4lnm")
	 */
	async deleteWorkspaceDirectory(
		_event: IpcMainInvokeEvent,
		subPath: string,
	): Promise<{ success: boolean; error?: string }> {
		const workspaceDir = path.join(getRuntimeComposeDir(), "workspace");

		// Prevent directory traversal
		const safeSubPath = subPath.replace(/\.\./g, "");
		const targetDir = path.join(workspaceDir, safeSubPath);

		// Safety: ensure targetDir is actually inside workspaceDir
		if (!targetDir.startsWith(workspaceDir)) {
			logger.error("Path traversal attempt blocked:", subPath);
			return { success: false, error: "Invalid path" };
		}

		try {
			if (fs.existsSync(targetDir)) {
				fs.rmSync(targetDir, { recursive: true, force: true });
				logger.debug("Deleted workspace directory:", targetDir);
			}
			return { success: true };
		} catch (error) {
			logger.error("Failed to delete workspace directory:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage };
		}
	}

	/**
	 * Rename a workspace directory via IPC
	 * @param oldSubPath - old subdirectory path relative to workspace (e.g. "projects/myFolder")
	 * @param newSubPath - new subdirectory path relative to workspace (e.g. "projects/newFolder")
	 */
	async renameWorkspaceDirectory(
		_event: IpcMainInvokeEvent,
		oldSubPath: string,
		newSubPath: string,
	): Promise<{ success: boolean; error?: string }> {
		const workspaceDir = path.join(getRuntimeComposeDir(), "workspace");

		// Prevent directory traversal
		const safeOldPath = oldSubPath.replace(/\.\./g, "");
		const safeNewPath = newSubPath.replace(/\.\./g, "");
		const oldDir = path.join(workspaceDir, safeOldPath);
		const newDir = path.join(workspaceDir, safeNewPath);

		// Safety: ensure both paths are inside workspaceDir
		if (!oldDir.startsWith(workspaceDir) || !newDir.startsWith(workspaceDir)) {
			logger.error("Path traversal attempt blocked:", oldSubPath, newSubPath);
			return { success: false, error: "Invalid path" };
		}

		try {
			if (!fs.existsSync(oldDir)) {
				return { success: false, error: "Source path not found" };
			}
			fs.renameSync(oldDir, newDir);
			logger.debug("Renamed workspace directory:", oldDir, "->", newDir);
			return { success: true };
		} catch (error) {
			logger.error("Failed to rename workspace directory:", error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			return { success: false, error: errorMessage };
		}
	}
}

export const codeAgentService = new CodeAgentService();
