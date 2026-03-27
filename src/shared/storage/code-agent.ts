import { type } from "arktype";

export const codeAgentType = type("'local' | 'remote'");
export type CodeAgentType = typeof codeAgentType.infer;
export const agentClass = type("'claude-code' | 'open-claw'");
export type AgentClass = typeof agentClass.infer;
export const codingAgentClass = type("'claude-code' | 'open-claw'");
export type CodingAgentClass = typeof codingAgentClass.infer;
export const codeAgentConfigMetadata = type({
	enabled: "boolean",
	threadId: "string",
	type: codeAgentType,
	currentAgentId: agentClass,
	codingAgentId: codingAgentClass,
	isDeleted: "boolean",
});
export type CodeAgentConfigMetadata = typeof codeAgentConfigMetadata.infer;
export const skill = type({
	name: "string",
	description: "string",
	description_zh: "string",
	isBuiltin: "boolean?",
	is_favorite: "boolean?",
	favorite_at: "(string|null)?",
	manual_import_at: "(string|null)?",
	source: "string?",
	bundled: "boolean?",
	content: "string?",
	/** Whether this skill should be forcefully included in prompts when enabled */
	forceUse: "boolean?",
});
export type Skill = typeof skill.infer;

export const thinkingBudgetType = type("'off' | 'low' | 'medium' | 'high' | 'max'");
export type ThinkingBudgetType = typeof thinkingBudgetType.infer;

export const codeAgentMetadata = type({
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
	sandboxId: "string",
	sandboxRemark: "string",
	skills: skill.array(),
	/**
	 * thinking budget for claude code
	 */
	thinkingBudget: thinkingBudgetType,
	/**
	 * Whether the session note was manually set by user.
	 * If true, auto-generated titles will not overwrite the note.
	 */
	isManualNote: "boolean",
	inPlanMode: "boolean",
});
export type CodeAgentMetadata = typeof codeAgentMetadata.infer;

export const codeAgentCfgs = type({
	baseUrl: "string",
	model: "string",
});
export type CodeAgentCfgs = typeof codeAgentCfgs.infer;

export const codeAgentCreateResult = type("'already-exist' | 'success' | 'failed'");
export type CodeAgentCreateResult = typeof codeAgentCreateResult.infer;

export const codeAgentSandboxStatus = type("'waiting-for-sandbox' | 'sandbox-created'");
export type CodeAgentSandboxStatus = typeof codeAgentSandboxStatus.infer;

export const claudeCodeSessionInfo = type({
	sessionId: "string",
	workspacePath: "string",
	note: "string | null",
	usedAt: "string",
});
export type ClaudeCodeSessionInfo = typeof claudeCodeSessionInfo.infer;

export const claudeCodeSandboxInfo = type({
	sandboxId: "string",
	sandboxRemark: "string",
	diskTotal: "number",
	diskUsed: "number",
	diskUsage: "'normal' | 'insufficient'",
	status: "'killed' | 'running' | 'paused'",
	llmModel: "string",
	createdAt: "string",
	updatedAt: "string",
	deletedAt: "string",
	sessionInfos: claudeCodeSessionInfo.array(),
});
export type ClaudeCodeSandboxInfo = typeof claudeCodeSandboxInfo.infer;

export const createClaudeCodeSandboxRequest = type({
	llm_model: "string",
	system_prompt: "string?",
	mcp_servers: "string[]?",
	sandbox_name: "string?",
	max_thinking_token: "number?",
});
export type CreateClaudeCodeSandboxRequest = typeof createClaudeCodeSandboxRequest.infer;
export const createClaudeCodeSandboxResponse = type({
	success: "boolean",
	data: {
		sandbox_id: "string",
		sandbox_name: "string",
	},
});
export type CreateClaudeCodeSandboxResponse = typeof createClaudeCodeSandboxResponse.infer;

export const Accounts = type({
	botToken: "string",
});

export const codeAgentGlobalConfigs = type({
	apiKey: "string",
	autoDeploy: "boolean",
	autoFixDeployFailure: "boolean",
	notificationsEnabled: "boolean",
	lastVibeMode: codeAgentType,
	lastAgentId: agentClass,
	feishu: type({ appId: "string", appSecret: "string" }),
	dingtalk: type({ clientId: "string", clientSecret: "string" }),
	qqbot: type({ appId: "string", clientSecret: "string" }),
	wecom: type({ botId: "string", secret: "string" }),
	telegram: type({
		accounts: type({
			default: Accounts,
		}),
	}),
	_version: "number?",
});
export type CodeAgentGlobalConfigs = typeof codeAgentGlobalConfigs.infer;

export const SUPPORTED_CHANNELS = ["feishu", "dingtalk", "qqbot", "wecom", "telegram"] as const;
export const WIN_SUPPORTED_CHANNELS = ["feishu", "telegram"] as const;
export type SupportedChannel = (typeof SUPPORTED_CHANNELS)[number];

export const taskSchema = type({
	id: "string",
	content: "string",
	status: "'pending' | 'in_progress' | 'done'",
	number: "number",
	executedCount: "number",
});
export const taskListSchema = taskSchema.array();
export type Task = typeof taskSchema.infer;

export const localSessionInfoSchema = type({
	session_id: "string",
	workspace_path: "string",
	note: "string | null",
	used_at: "string",
	oc_agent_id: "string",
});
export type LocalSessionInfo = typeof localSessionInfoSchema.infer;
export const listLocalClaudeCodeSessionsResponse = type({
	success: "boolean",
	session_list: localSessionInfoSchema.array(),
});
export type ListLocalClaudeCodeSessionsResponse = typeof listLocalClaudeCodeSessionsResponse.infer;

export const localVibeStorageData = type({
	/** Whether the VM configuration needs to be updated */
	needUpdateVmConfig: "boolean",
	/** Whether wsl.conf needs to be updated */
	needUpdateWslConf: "boolean",
	openclawJsonTemplateVersion: "number",
});
export type LocalVibeStorageData = typeof localVibeStorageData.infer;
