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
	get enabled(): boolean {
		return persistedCodeAgentState.current.enabled;
	}

	set enabled(value: boolean) {
		persistedCodeAgentState.current.enabled = value;
	}

	get currentSessionId(): string {
		return persistedCodeAgentState.current.currentSessionId;
	}

	set currentSessionId(value: string) {
		persistedCodeAgentState.current.currentSessionId = value;
	}

	get agentId(): string {
		return persistedCodeAgentState.current.agentId;
	}

	set agentId(value: string) {
		persistedCodeAgentState.current.agentId = value;
	}

	get sessionIds(): string[] {
		return persistedCodeAgentState.current.sessionIds;
	}

	set sessionIds(value: string[]) {
		persistedCodeAgentState.current.sessionIds = value;
	}

	get type(): "local" | "remote" {
		return persistedCodeAgentState.current.type;
	}

	set type(value: "local" | "remote") {
		persistedCodeAgentState.current.type = value;
	}

	get sandboxId(): string {
		return persistedCodeAgentState.current.sandboxId;
	}

	set sandboxId(value: string) {
		persistedCodeAgentState.current.sandboxId = value;
	}

	async createClaudeCodeSandbox() {
		const sandboxExist = this.sandboxId !== "";
		if (sandboxExist) return;
		const { isOK, sandboxId } = await createClaudeCodeSandbox(threadId);
		if (isOK) {
			this.sandboxId = sandboxId;
		}
	}
}

export const codeAgentState = new CodeAgentState();
