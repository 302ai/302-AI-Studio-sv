import { CodeAgentMetadata } from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
import { isNull } from "es-toolkit";
import { StorageService } from ".";

class CodeAgentStorage extends StorageService<CodeAgentMetadata> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	async setClaudeCodeSandboxId(threadId: string, sandboxId: string): Promise<{ isOK: boolean }> {
		const key = `code-agent-state-${threadId}`;
		const codeAgentMetadata = await this.getItemInternal(key);

		if (isNull(codeAgentMetadata)) return { isOK: false };

		codeAgentMetadata.sandboxId = sandboxId;
		await this.setItemInternal(key, codeAgentMetadata);
		return { isOK: true };
	}

	async removeCodeAgentState(threadId: string): Promise<void> {
		const key = `code-agent-state-${threadId}`;
		await this.removeItemInternal(key);
	}
}

export const codeAgentStorage = new CodeAgentStorage();
