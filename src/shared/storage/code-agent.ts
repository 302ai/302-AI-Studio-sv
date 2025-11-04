import { type } from "arktype";

export const CodeAgentMetadata = type({
	type: "'local' | 'remote'",
	agentId: "string",
	/**
	 * local agent only
	 */
	currentWorkspacePath: "string",
	workspacePaths: "string[]",
	variables: "string[]",
	/**
	 * remote agent only
	 */
	currentSessionId: "string",
	sessionIds: "string[]",
	sandboxId: "string",
});
export type CodeAgentMetadata = typeof CodeAgentMetadata.infer;
