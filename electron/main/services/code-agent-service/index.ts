import { createClaudeCodeSandbox } from "@electron/main/apis/code-agent";
import type { IpcMainInvokeEvent } from "electron";
import { codeAgentStorage } from "../storage-service/code-agent-storage";

export class CodeAgentService {
	private storage;

	constructor() {
		this.storage = codeAgentStorage;
	}

	// ******************************* IPC Methods ******************************* //
	async createClaudeCodeSandbox(
		_event: IpcMainInvokeEvent,
		threadId: string,
		llm_model?: string,
	): Promise<{ isOK: boolean; sandboxId: string }> {
		const response = await createClaudeCodeSandbox(llm_model);
		if (response.success) {
			const sandboxId = response.data.sandbox_id;
			await this.storage.setClaudeCodeSandboxId(threadId, sandboxId);
			return { isOK: true, sandboxId };
		}
		return { isOK: false, sandboxId: "" };
	}
}

export const codeAgentService = new CodeAgentService();
