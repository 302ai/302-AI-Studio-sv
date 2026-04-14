import type { CodeAgentType } from "@shared/storage/code-agent";

export function canFavoriteSkill(type: CodeAgentType, isBuiltin: boolean): boolean {
	return type === "local" || type === "cloud" || !isBuiltin;
}
