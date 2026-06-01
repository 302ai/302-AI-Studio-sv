import type {
	AgentClass,
	CodeAgentConfigMetadata,
	CodeAgentGlobalConfigs,
	CodingAgentClass,
} from "@shared/storage/code-agent";

export function createInitialCodeAgentConfig(
	threadId: string,
	globalConfigs: CodeAgentGlobalConfigs,
): CodeAgentConfigMetadata {
	const shouldEnableVibe = globalConfigs.lastSessionMode === "vibe";

	// Determine the initial agent based on mode and compatibility
	// Remote mode only supports claude-code, other modes use lastAgentId
	const currentAgentId: AgentClass =
		shouldEnableVibe && globalConfigs.lastVibeMode !== "remote"
			? globalConfigs.lastAgentId
			: "claude-code";
	const codingAgentId: CodingAgentClass =
		currentAgentId === "open-claw" ? "claude-code" : currentAgentId;

	return {
		enabled: shouldEnableVibe,
		threadId,
		type: shouldEnableVibe ? globalConfigs.lastVibeMode : "remote",
		currentAgentId,
		codingAgentId,
		isDeleted: false,
	};
}
