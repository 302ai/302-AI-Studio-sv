import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { CodeAgentMetadata } from "@shared/storage/code-agent";

const tab = window.tab ?? null;

const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

export const persistedCodeAgentState = new PersistedState<CodeAgentMetadata>(
	"CodeAgentStorage:code-agent-state" + "-" + threadId,
	{
		enabled: false,
		threadId: threadId,
		type: "remote",
		agentId: "",
		currentWorkspacePath: "",
		workspacePaths: [],
		variables: [],
		currentSessionId: "",
		sessionIds: [],
		sandboxId: "",
	},
);

const { createClaudeCodeSandbox } = window.electronAPI.codeAgentService;

class CodeAgentState {
	enabled = $derived(persistedCodeAgentState.current.enabled);
	type = $derived(persistedCodeAgentState.current.type);
	agentId = $derived(persistedCodeAgentState.current.agentId);
	currentSessionId = $derived(persistedCodeAgentState.current.currentSessionId);
	sessionIds = $derived(persistedCodeAgentState.current.sessionIds);
	sandboxId = $derived(persistedCodeAgentState.current.sandboxId);

	baseUrl = $derived("https://api.302.ai/302/claude-code/v1");
	ready = $derived(this.enabled && this.sandboxId !== "");

	updateState(partial: Partial<CodeAgentMetadata>): void {
		persistedCodeAgentState.current = {
			...persistedCodeAgentState.current,
			...partial,
		};
	}

	async createClaudeCodeSandbox(): Promise<"already-exist" | "success" | "failed"> {
		const sandboxExist = this.sandboxId !== "";
		if (sandboxExist) return "already-exist";
		const { isOK, sandboxId } = await createClaudeCodeSandbox(threadId);
		if (isOK) {
			this.updateState({ sandboxId });
			return "success";
		}
		return "failed";
	}

	// TODO: refresh session ids
	async refreshSessionIds() {}
}

export const codeAgentState = new CodeAgentState();
