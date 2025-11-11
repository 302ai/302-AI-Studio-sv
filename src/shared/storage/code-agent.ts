import { type } from "arktype";

export const CodeAgentConfigMetadata = type({
	enabled: "boolean",
	threadId: "string",
	type: "'local' | 'remote'",
	currentAgentId: "string",
});
export type CodeAgentConfigMetadata = typeof CodeAgentConfigMetadata.infer;

export const CodeAgentMetadata = type({
	model: "string",
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

export const CodeAgentCfgs = type({
	baseUrl: "string",
	model: "string",
});
export type CodeAgentCfgs = typeof CodeAgentCfgs.infer;

export const CodeAgentCreateResult = type("'already-exist' | 'success' | 'failed'");
export type CodeAgentCreateResult = typeof CodeAgentCreateResult.infer;
