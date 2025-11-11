import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { CodeAgentMetadata } from "@shared/storage/code-agent";
import { nanoid } from "nanoid";

const tab = window.tab ?? null;

const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

function getInitialData() {
	const initialSessionId = nanoid();
	const initialData = {
		model: "claude-sonnet-4-5-20250929",
		currentWorkspacePath: "",
		workspacePaths: [],
		variables: [],
		currentSessionId: initialSessionId,
		sessionIds: [initialSessionId],
		sandboxId: "",
	};
	return initialData;
}

export const persistedClaudeCodeAgentState = new PersistedState<CodeAgentMetadata>(
	"CodeAgentStorage:claude-code-agent-state" + "-" + threadId,
	getInitialData(),
);

const { createClaudeCodeSandbox } = window.electronAPI.codeAgentService;

class ClaudeCodeAgentState {
	currentSessionId = $derived(persistedClaudeCodeAgentState.current.currentSessionId);
	sessionIds = $derived(persistedClaudeCodeAgentState.current.sessionIds);
	sandboxId = $derived(persistedClaudeCodeAgentState.current.sandboxId);
	baseUrl = $derived("https://api.302.ai/302/claude-code/v1");
	ready = $derived(this.sandboxId !== "");

	updateState(partial: Partial<CodeAgentMetadata>): void {
		persistedClaudeCodeAgentState.current = {
			...persistedClaudeCodeAgentState.current,
			...partial,
		};
	}

	async createClaudeCodeSandbox(): Promise<"already-exist" | "success" | "failed"> {
		const sandboxExist = this.sandboxId !== "";
		if (sandboxExist) return "already-exist";
		const { isOK, sandboxId } = await createClaudeCodeSandbox(threadId);
		if (isOK) {
			const sessionId = nanoid();
			const sessionIds = [sessionId, ...this.sessionIds];
			this.updateState({ sandboxId, currentSessionId: sessionId, sessionIds });
			return "success";
		}
		return "failed";
	}

	// TODO: refresh session ids
	async refreshSessionIds() {}
}

export const claudeCodeAgentState = new ClaudeCodeAgentState();
