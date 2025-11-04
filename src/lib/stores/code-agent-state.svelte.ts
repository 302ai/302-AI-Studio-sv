import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { CodeAgentMetadata } from "@shared/storage/code-agent";

export const persistedCodeAgentState = new PersistedState<CodeAgentMetadata>("code-agent-state", {
	type: "remote",
	agentId: "",
	currentWorkspacePath: "",
	workspacePaths: [],
	variables: [],
	currentSessionId: "",
	sessionIds: [],
	sandboxId: "",
});
