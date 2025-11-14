import { CodeAgentMetadata } from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
import { isNull } from "es-toolkit";
import { nanoid } from "nanoid";
import { StorageService } from "..";

class ClaudeCodeStorage extends StorageService<CodeAgentMetadata> {
	private prefix = "claude-code-agent-state";
	private defaultModel = "claude-sonnet-4-5-20250929";

	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	private async ensureMetadata(key: string): Promise<CodeAgentMetadata> {
		const existingMetadata = await this.getItemInternal(key);
		if (!isNull(existingMetadata)) {
			return existingMetadata;
		}

		const sessionId = nanoid();
		const initialMetadata: CodeAgentMetadata = {
			model: this.defaultModel,
			currentWorkspacePath: "",
			workspacePaths: [],
			variables: [],
			currentSessionId: sessionId,
			sessionIds: [sessionId],
			sandboxId: "",
		};

		await this.setItemInternal(key, initialMetadata);
		return initialMetadata;
	}

	async setClaudeCodeSandboxId(threadId: string, sandboxId: string): Promise<{ isOK: boolean }> {
		const key = `${this.prefix}-${threadId}`;
		const codeAgentMetadata = await this.ensureMetadata(key);

		codeAgentMetadata.sandboxId = sandboxId;
		await this.setItemInternal(key, codeAgentMetadata);
		return { isOK: true };
	}

	async getClaudeCodeSandboxId(threadId: string): Promise<{ isOK: boolean; sandboxId: string }> {
		const key = `${this.prefix}-${threadId}`;
		const codeAgentMetadata = await this.getItemInternal(key);
		if (isNull(codeAgentMetadata)) return { isOK: false, sandboxId: "" };
		return { isOK: true, sandboxId: codeAgentMetadata.sandboxId };
	}
}

export const claudeCodeStorage = new ClaudeCodeStorage();
