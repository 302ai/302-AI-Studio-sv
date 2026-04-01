import type {
	ClaudeCodeSandboxInfo,
	ClaudeCodeSessionInfo,
	CodeAgentMetadata,
} from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
import { createLogger } from "@shared/logger";

const logger = createLogger("storage");
import { isNull } from "es-toolkit";
import { StorageService } from "..";

class ClaudeCodeStorage extends StorageService<CodeAgentMetadata> {
	private prefix = "claude-code-agent-state";

	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	async setClaudeCodeSandboxInfo(
		threadId: string,
		sandboxId: string,
		sandboxRemark: string,
	): Promise<{ isOK: boolean }> {
		const key = `${this.prefix}-${threadId}`;
		try {
			const codeAgentMetadata = await this.getItemInternal(key);

			if (isNull(codeAgentMetadata)) return { isOK: false };

			codeAgentMetadata.sandboxId = sandboxId;
			codeAgentMetadata.sandboxRemark = sandboxRemark;
			await this.setItemInternal(key, codeAgentMetadata);
			return { isOK: true };
		} catch (error) {
			logger.error("Error setting Claude code sandbox ID:", error);
			return { isOK: false };
		}
	}

	async getClaudeCodeSandboxId(threadId: string): Promise<{ isOK: boolean; sandboxId: string }> {
		const key = `${this.prefix}-${threadId}`;
		try {
			const codeAgentMetadata = await this.getItemInternal(key);
			if (isNull(codeAgentMetadata)) return { isOK: false, sandboxId: "" };
			return { isOK: true, sandboxId: codeAgentMetadata.sandboxId };
		} catch (error) {
			logger.error("Error getting Claude code sandbox ID:", error);
			return { isOK: false, sandboxId: "" };
		}
	}

	async setClaudeCodeModel(threadId: string, llm_model: string): Promise<{ isOK: boolean }> {
		const key = `${this.prefix}-${threadId}`;
		try {
			const codeAgentMetadata = await this.getItemInternal(key);
			if (isNull(codeAgentMetadata)) return { isOK: false };
			codeAgentMetadata.model = llm_model;
			await this.setItemInternal(key, codeAgentMetadata);
			return { isOK: true };
		} catch (error) {
			logger.error("Error setting Claude code model:", error);
			return { isOK: false };
		}
	}

	async updateClaudeCodeCurrentSessionIdByThreadId(
		threadId: string,
		sessionId: string,
	): Promise<{ isOK: boolean }> {
		const key = `${this.prefix}-${threadId}`;
		try {
			const codeAgentMetadata = await this.getItemInternal(key);
			if (isNull(codeAgentMetadata)) return { isOK: false };
			if (codeAgentMetadata.sandboxId !== "") {
				codeAgentMetadata.currentSessionId = sessionId;
			}
			await this.setItemInternal(key, codeAgentMetadata);
			return { isOK: true };
		} catch (error) {
			logger.error("Error updating Claude code sessions:", error);
			return { isOK: false };
		}
	}
}

class ClaudeCodeSandboxStorage extends StorageService<ClaudeCodeSandboxInfo[]> {
	private prefix = "claude-code-sandbox-state";

	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	async getClaudeCodeSandboxes(): Promise<{ isOK: boolean; sandboxes: ClaudeCodeSandboxInfo[] }> {
		try {
			const sandboxes = await this.getItemInternal(this.prefix);
			if (isNull(sandboxes)) return { isOK: false, sandboxes: [] };
			return { isOK: true, sandboxes };
		} catch (error) {
			logger.error("Error getting Claude code sandboxes:", error);
			return { isOK: false, sandboxes: [] };
		}
	}

	async setClaudeCodeSandboxes(list: ClaudeCodeSandboxInfo[]): Promise<{ isOK: boolean }> {
		try {
			await this.setItemInternal(this.prefix, list);
			return { isOK: true };
		} catch (error) {
			logger.error("Error setting Claude code sandboxes:", error);
			return { isOK: false };
		}
	}

	async addSandbox(
		sandboxId: string,
		sandboxName: string,
		llmModel: string,
	): Promise<{ isOK: boolean }> {
		try {
			const { isOK, sandboxes } = await this.getClaudeCodeSandboxes();
			if (!isOK) return { isOK: false };

			const newSandbox: ClaudeCodeSandboxInfo = {
				sandboxId,
				sandboxRemark: sandboxName,
				llmModel,
				sessionInfos: [],
				diskTotal: -1,
				diskUsed: -1,
				diskUsage: "normal",
				status: "paused",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				deletedAt: "",
			};

			sandboxes.push(newSandbox);
			await this.setItemInternal(this.prefix, sandboxes);
			return { isOK: true };
		} catch (error) {
			logger.error("Error adding Claude code sandbox:", error);
			return { isOK: false };
		}
	}

	async setClaudeCodeSessions(
		sandboxId: string,
		sessions: ClaudeCodeSessionInfo[],
	): Promise<{ isOK: boolean }> {
		try {
			const { isOK, sandboxes } = await this.getClaudeCodeSandboxes();
			if (!isOK) return { isOK: false };

			const sandbox = sandboxes.find((s) => s.sandboxId === sandboxId);
			if (!sandbox) return { isOK: false };

			sandbox.sessionInfos = sessions;

			await this.setItemInternal(this.prefix, sandboxes);
			return { isOK: true };
		} catch (error) {
			logger.error("Error setting Claude code sessions:", error);
			return { isOK: false };
		}
	}
}

export const claudeCodeStorage = new ClaudeCodeStorage();
export const claudeCodeSandboxStorage = new ClaudeCodeSandboxStorage();
