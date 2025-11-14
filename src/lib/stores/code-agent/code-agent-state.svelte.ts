import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { chatState } from "$lib/stores/chat-state.svelte";
import type { Model } from "@302ai/studio-plugin-sdk";
import {
	CodeAgentCfgs,
	CodeAgentConfigMetadata,
	CodeAgentSandboxStatus,
} from "@shared/storage/code-agent";
import { match } from "ts-pattern";
import { claudeCodeAgentState } from "./claude-code-state.svelte";

const tab = window.tab ?? null;

const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

export const persistedCodeAgentConfigState = new PersistedState<CodeAgentConfigMetadata>(
	"CodeAgentStorage:code-agent-config-state" + "-" + threadId,
	{
		enabled: false,
		threadId: threadId,
		type: "remote",
		currentAgentId: "",
	},
);

const { updateClaudeCodeSandbox } = window.electronAPI.codeAgentService;

class CodeAgentState {
	enabled = $derived.by(() => persistedCodeAgentConfigState.current.enabled);

	type = $derived(persistedCodeAgentConfigState.current.type);
	currentAgentId = $derived(persistedCodeAgentConfigState.current.currentAgentId);
	isFreshTab = $derived(!chatState.hasMessages);
	inCodeAgentMode = $derived(!this.isFreshTab && this.enabled);

	sandboxStatus = $derived.by<CodeAgentSandboxStatus>(() => {
		return match(this.currentAgentId)
			.with("claude-code", () =>
				claudeCodeAgentState.sandboxId === "" ? "waiting-for-sandbox" : "sandbox-created",
			)
			.otherwise(() => "waiting-for-sandbox");
	});

	updateState(partial: Partial<CodeAgentConfigMetadata>): void {
		persistedCodeAgentConfigState.current = {
			...persistedCodeAgentConfigState.current,
			...partial,
		};
	}

	getCodeAgentCfgs(): CodeAgentCfgs {
		return match(this.currentAgentId)
			.with("claude-code", () => ({
				baseUrl: claudeCodeAgentState.baseUrl,
				model: claudeCodeAgentState.sandboxId,
			}))
			.otherwise(() => ({ baseUrl: "", model: "" }));
	}

	getCurrentSessionId(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.currentSessionId)
			.otherwise(() => "");
	}

	getSandboxId(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.sandboxId)
			.otherwise(() => "");
	}

	async handleCodeAgentModelChange(model: Model): Promise<boolean> {
		if (this.currentAgentId === "claude-code") {
			const { isOK } = await updateClaudeCodeSandbox(threadId, this.getSandboxId(), model.id);
			return isOK;
		}

		return false;
	}

	// async createSandbox(): Promise<CodeAgentCreateResult> {
	// 	let createResult: CodeAgentCreateResult = "failed";
	// 	if (this.currentAgentId === "claude-code") {
	// 		createResult = await claudeCodeAgentState.createClaudeCodeSandbox();
	// 	}

	// 	if (createResult === "failed") {
	// 		toast.error(m.sandbox_create_failed());
	// 	}

	// 	return createResult;
	// }
}

export const codeAgentState = new CodeAgentState();
