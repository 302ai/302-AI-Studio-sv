import { createClaudeCodeSandbox } from "@electron/main/apis/code-agent";
import { CodeAgentCreateResult } from "@shared/storage/code-agent";
import { broadcastService } from "../broadcast-service";
import { claudeCodeStorage, codeAgentStorage } from "../storage-service/code-agent";

export class CodeAgentService {
	private codeAgentStorage;
	private claudeCodeStorage;

	constructor() {
		this.codeAgentStorage = codeAgentStorage;
		this.claudeCodeStorage = claudeCodeStorage;
	}

	async removeCodeAgentState(threadId: string): Promise<void> {
		await this.codeAgentStorage.removeCodeAgentState(threadId);
	}

	async createClaudeCodeSandbox(
		threadId: string,
		llm_model?: string,
	): Promise<{ createdResult: CodeAgentCreateResult; sandboxId: string }> {
		const { isOK, sandboxId } = await this.claudeCodeStorage.getClaudeCodeSandboxId(threadId);
		if (isOK && sandboxId !== "") {
			this.notifySandboxUpdated(threadId, sandboxId);
			return { createdResult: "already-exist", sandboxId };
		}

		const response = await createClaudeCodeSandbox(llm_model);
		if (response.success) {
			const sandboxId = response.data.sandbox_id;
			await this.claudeCodeStorage.setClaudeCodeSandboxId(threadId, sandboxId);
			this.notifySandboxUpdated(threadId, sandboxId);
			return { createdResult: "success", sandboxId };
		}
		return { createdResult: "failed", sandboxId: "" };
	}

	// ******************************* IPC Methods ******************************* //
	// async createClaudeCodeSandbox(
	// 	_event: IpcMainInvokeEvent,
	// 	threadId: string,
	// 	llm_model?: string,
	// ): Promise<{ isOK: boolean; sandboxId: string }> {
	// 	const response = await createClaudeCodeSandbox(llm_model);
	// 	if (response.success) {
	// 		const sandboxId = response.data.sandbox_id;
	// 		await this.storage.setClaudeCodeSandboxId(threadId, sandboxId);
	// 		return { isOK: true, sandboxId };
	// 	}
	// 	return { isOK: false, sandboxId: "" };
	// }

	private notifySandboxUpdated(threadId: string, sandboxId: string): void {
		broadcastService.broadcastChannelToAll("code-agent:sandbox-updated", {
			threadId,
			sandboxId,
		});
	}
}

export const codeAgentService = new CodeAgentService();
