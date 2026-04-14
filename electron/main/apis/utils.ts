import type { CodeAgentType } from "@shared/types";
import { match } from "ts-pattern";
import { _302AIKy } from "./core/_302ai-ky";
import { cloudModeKy } from "./core/cloud-mode-ky";
import { localCodeAgentKy } from "./core/code-agent-ky";

/**
 * Get the appropriate ky instance based on the sandbox id
 * @param sandboxId - The sandbox id (string or 'local' | 'cloud') to get the ky instance for
 * @returns The ky instance for the given sandbox id
 */
export function getCodeAgentKyBySandboxId(sandboxId: string | "local" | "cloud") {
	return match(sandboxId)
		.with("local", () => localCodeAgentKy)
		.with("cloud", () => cloudModeKy)
		.otherwise(() => _302AIKy);
}

/**
 * Get the appropriate ky instance based on the code agent type
 * @param mode - The code agent type ('local' | 'remote' | 'cloud') to get the ky instance for
 * @returns The ky instance for the given code agent type
 */
export function getCodeAgentKyByMode(mode: CodeAgentType) {
	return match(mode)
		.with("local", () => localCodeAgentKy)
		.with("cloud", () => cloudModeKy)
		.otherwise(() => _302AIKy);
}
