import { type } from "arktype";
import { _302AIKy } from "./core/_302ai-ky";

const createClaudeCodeSandboxSchema = type({
	success: "boolean",
	data: {
		sandbox_id: "string",
	},
});
export type CreateClaudeCodeSandboxResponse = typeof createClaudeCodeSandboxSchema.infer;

/**
 * Create a claude code sandbox
 * @param llm_model - The llm model to use
 * @returns The created claude code sandbox
 */
export async function createClaudeCodeSandbox(
	llm_model?: string,
): Promise<CreateClaudeCodeSandboxResponse> {
	try {
		const response = await _302AIKy
			.post("302/claude-code/sandbox/create", {
				json: { llm_model: llm_model ?? "claude-sonnet-4-5-20250929" },
			})
			.json();

		console.debug(response);

		const validated = createClaudeCodeSandboxSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate create claude code sandbox:", validated.summary);
			throw new Error("Invalid response format from create claude code sandbox API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to create claude code sandbox:", error);
		throw error;
	}
}

const updateClaudeCodeSandboxSchema = type({
	success: "boolean",
	data: {
		message: "string",
	},
});
export type UpdateClaudeCodeSandboxResponse = typeof updateClaudeCodeSandboxSchema.infer;

export async function updateClaudeCodeSandbox(
	sandbox_id: string,
	llm_model: string,
): Promise<UpdateClaudeCodeSandboxResponse> {
	try {
		const response = await _302AIKy
			.post("302/claude-code/sandbox/reset", {
				json: { sandbox_id, llm_model },
			})
			.json();

		console.debug(response);

		const validated = updateClaudeCodeSandboxSchema(response);
		if (validated instanceof type.errors) {
			console.error("Failed to validate update claude code sandbox:", validated.summary);
			throw new Error("Invalid response format from update claude code sandbox API");
		}
		return validated;
	} catch (error) {
		console.error("Failed to update claude code sandbox:", error);
		throw error;
	}
}
