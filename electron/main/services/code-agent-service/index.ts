import { createClaudeCodeSandbox, updateClaudeCodeSandbox } from "@electron/main/apis/code-agent";
import { CodeAgentCreateResult } from "@shared/storage/code-agent";
import type { IpcMainInvokeEvent } from "electron";
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
			return { createdResult: "already-exist", sandboxId };
		}

		const response = await createClaudeCodeSandbox(llm_model);
		if (response.success) {
			const sandboxId = response.data.sandbox_id;
			await this.claudeCodeStorage.setClaudeCodeSandboxId(threadId, sandboxId);
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

	async updateClaudeCodeSandbox(
		_event: IpcMainInvokeEvent,
		threadId: string,
		sandbox_id: string,
		llm_model: string,
	): Promise<{ isOK: boolean; llm_model: string }> {
		try {
			const response = await updateClaudeCodeSandbox(sandbox_id, llm_model);
			if (response.success) {
				await this.claudeCodeStorage.setClaudeCodeModel(threadId, llm_model);
				return { isOK: true, llm_model };
			}
			return { isOK: false, llm_model: "" };
		} catch (error) {
			console.error("Error updating Claude code sandbox:", error);
			return { isOK: false, llm_model: "" };
		}
	}
}

export const codeAgentService = new CodeAgentService();
