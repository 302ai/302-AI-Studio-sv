import { CodeAgentMetadata } from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
import { isNull } from "es-toolkit";
import { StorageService } from "..";

class ClaudeCodeStorage extends StorageService<CodeAgentMetadata> {
	private prefix = "claude-code-agent-state";

	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	async setClaudeCodeSandboxId(threadId: string, sandboxId: string): Promise<{ isOK: boolean }> {
		const key = `${this.prefix}-${threadId}`;
		const codeAgentMetadata = await this.getItemInternal(key);

		if (isNull(codeAgentMetadata)) return { isOK: false };

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
