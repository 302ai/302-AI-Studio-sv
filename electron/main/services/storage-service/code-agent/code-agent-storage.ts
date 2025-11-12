import { CodeAgentConfigMetadata } from "@shared/storage/code-agent";
import { prefixStorage } from "@shared/types";
import { StorageService } from "..";

class CodeAgentStorage extends StorageService<CodeAgentConfigMetadata> {
	constructor() {
		super();
		this.storage = prefixStorage(this.storage, "CodeAgentStorage");
	}

	async removeCodeAgentState(threadId: string): Promise<void> {
		await Promise.all([
			this.removeItemInternal(`code-agent-config-state-${threadId}`),
			this.removeItemInternal(`claude-code-agent-state-${threadId}`),
		]);
	}
}

export const codeAgentStorage = new CodeAgentStorage();
