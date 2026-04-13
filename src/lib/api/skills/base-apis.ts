import { createLogger } from "@shared/logger";
import { skill } from "@shared/types";
import { type } from "arktype";
import { getCodeAgentKy, isLocalOrCloudMode } from "../utils";

const logger = createLogger("apis");

function normalizeSkillRecord(value: unknown) {
	if (!value || typeof value !== "object") {
		return value;
	}

	const skillRecord = value as Record<string, unknown>;

	return {
		...skillRecord,
		description: typeof skillRecord.description === "string" ? skillRecord.description : "",
		description_zh:
			typeof skillRecord.description_zh === "string" ? skillRecord.description_zh : "",
		favorite_at:
			typeof skillRecord.favorite_at === "string" || skillRecord.favorite_at === null
				? skillRecord.favorite_at
				: null,
		manual_import_at:
			typeof skillRecord.manual_import_at === "string" ||
			skillRecord.manual_import_at === null
				? skillRecord.manual_import_at
				: null,
	};
}

function normalizeSkillList(value: unknown) {
	return Array.isArray(value) ? value.map(normalizeSkillRecord) : value;
}

function normalizeListSkillsResponse(value: unknown) {
	if (!value || typeof value !== "object") {
		return value;
	}

	const response = value as Record<string, unknown>;

	return {
		...response,
		user_skills: normalizeSkillList(response.user_skills),
		builtin_skills: normalizeSkillList(response.builtin_skills),
		project_skills: normalizeSkillList(response.project_skills),
	};
}

export const listSkillsRequestSchema = type({
	sandboxId: "string?",
	sessionId: "string?",
	projectPath: "string?",
});
export type ListSkillsRequest = typeof listSkillsRequestSchema.infer;
export const listSkillsResponseSchema = type({
	success: "boolean",
	user_skills: skill.array(),
	builtin_skills: skill.array(),
	project_skills: skill.array(),
});
export type ListSkillsResponse = typeof listSkillsResponseSchema.infer;

export async function _listSkills(request: ListSkillsRequest): Promise<ListSkillsResponse> {
	const { sandboxId, sessionId, projectPath } = request;
	try {
		const kyInstance = await getCodeAgentKy();

		// Local mode doesn't need sandbox_id
		const searchParams = isLocalOrCloudMode()
			? {
					session_id: sessionId,
					project_path: projectPath,
				}
			: {
					sandbox_id: sandboxId,
					session_id: sessionId,
					project_path: projectPath,
				};

		const response = await kyInstance
			.get("302/claude-code/skills/list", {
				searchParams,
			})
			.json();

		const validated = listSkillsResponseSchema(normalizeListSkillsResponse(response));
		if (validated instanceof type.errors) {
			logger.error("Failed to validate list skills response:", validated.summary);
			throw new Error("Invalid response format from list skills API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to list skills:", error);
		throw error;
	}
}

export const skillDetailsRequestSchema = type({
	skillName: "string",
	builtin: "boolean?",
});
export type SkillDetailsRequest = typeof skillDetailsRequestSchema.infer;
export const checkSkillDetailsResponseSchema = type({
	success: "boolean",
	skill: skill,
});
export type CheckSkillDetailsResponse = typeof checkSkillDetailsResponseSchema.infer;

export async function checkSkillDetails(
	request: SkillDetailsRequest,
): Promise<CheckSkillDetailsResponse> {
	const { skillName, builtin } = request;
	try {
		const kyInstance = await getCodeAgentKy();
		const response = await kyInstance
			.get("302/claude-code/skills/detail", {
				searchParams: {
					name: skillName,
					mode: "view",
					builtin,
				},
			})
			.json();

		const validated = checkSkillDetailsResponseSchema({
			...((response as Record<string, unknown>) ?? {}),
			skill: normalizeSkillRecord((response as Record<string, unknown>)?.skill),
		});
		if (validated instanceof type.errors) {
			logger.error("Failed to validate check skill details response:", validated.summary);
			throw new Error("Invalid response format from check skill details API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to check skill details:", error);
		throw error;
	}
}

export async function _editSkillDetails(request: SkillDetailsRequest): Promise<Blob> {
	const { skillName, builtin } = request;
	try {
		const kyInstance = await getCodeAgentKy();
		const response = await kyInstance
			.get("302/claude-code/skills/detail", {
				searchParams: {
					name: skillName,
					mode: "edit",
					builtin: builtin ?? false,
				},
			})
			.blob();

		return response;
	} catch (error) {
		// Handle HTTP errors (ky throws on non-2xx responses)
		if (error && typeof error === "object" && "response" in error) {
			const httpError = error as { response: Response };
			try {
				const errorBody = await httpError.response.json();
				if (errorBody && typeof errorBody === "object" && errorBody.error?.message) {
					throw new Error(errorBody.error.message);
				}
			} catch (parseError) {
				// If it's already our custom error, rethrow it
				if (parseError instanceof Error && parseError.message !== "Unexpected token") {
					throw parseError;
				}
			}
		}
		logger.error("Failed to edit skill details:", error);
		throw error;
	}
}

export const createSkillResponseSchema = type({
	success: "boolean",
	message: "string?",
	error: type({
		message: "string",
	}).optional(),
});
export type CreateSkillResponse = typeof createSkillResponseSchema.infer;

export async function _createSkill(zipFile: File): Promise<CreateSkillResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const formData = new FormData();
		formData.append("file", zipFile);

		const response = await kyInstance
			.post("302/claude-code/skills", {
				body: formData,
				timeout: 120000,
			})
			.json();

		const validated = createSkillResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate create skill response:", validated.summary);
			throw new Error("Invalid response format from create skill API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to create skill:", error);
		throw error;
	}
}

export async function _createSkillFromGitHub(githubUrl: string): Promise<CreateSkillResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const formData = new FormData();
		formData.append("github_url", githubUrl);

		const response = await kyInstance
			.post("302/claude-code/skills", {
				body: formData,
				timeout: 120000,
			})
			.json();

		const validated = createSkillResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error(
				"Failed to validate create skill from GitHub response:",
				validated.summary,
			);
			throw new Error("Invalid response format from create skill API");
		}
		return validated;
	} catch (error) {
		// Handle HTTP errors (ky throws on non-2xx responses)
		if (error && typeof error === "object" && "response" in error) {
			const httpError = error as { response: Response };
			try {
				const errorBody = await httpError.response.json();
				if (errorBody && typeof errorBody === "object") {
					return {
						success: false,
						error: errorBody.error,
						message: errorBody.message,
					};
				}
			} catch {
				// Failed to parse error response JSON
			}
		}
		logger.error("Failed to create skill from GitHub:", error);
		throw error;
	}
}

export const deleteSkillRequestSchema = type({
	skill_list: "string[]",
});
export type DeleteSkillRequest = typeof deleteSkillRequestSchema.infer;
export const deleteSkillResponseSchema = type({
	success: "boolean",
});
export type DeleteSkillResponse = typeof deleteSkillResponseSchema.infer;

export async function deleteSkill(request: DeleteSkillRequest): Promise<DeleteSkillResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const response = await kyInstance
			.delete("302/claude-code/skills", {
				json: request,
			})
			.json();

		const validated = deleteSkillResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate delete skill response:", validated.summary);
			throw new Error("Invalid response format from delete skill API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to delete skill:", error);
		throw error;
	}
}

export const skillFavoriteRequestSchema = type({
	skill_list: "string[]",
});
export type SkillFavoriteRequest = typeof skillFavoriteRequestSchema.infer;
export const skillFavoriteResponseSchema = type({
	success: "boolean",
});
export type SkillFavoriteResponse = typeof skillFavoriteResponseSchema.infer;

export async function addSkillFavorite(
	request: SkillFavoriteRequest,
): Promise<SkillFavoriteResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const response = await kyInstance
			.post("302/claude-code/skills/favorite/add", {
				json: request,
			})
			.json();

		const validated = skillFavoriteResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate add skill favorite response:", validated.summary);
			throw new Error("Invalid response format from add skill favorite API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to add skill favorite:", error);
		throw error;
	}
}

export async function cancelSkillFavorite(
	request: SkillFavoriteRequest,
): Promise<SkillFavoriteResponse> {
	try {
		const kyInstance = await getCodeAgentKy();
		const response = await kyInstance
			.post("302/claude-code/skills/favorite/cancel", {
				json: request,
			})
			.json();

		const validated = skillFavoriteResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate cancel skill favorite response:", validated.summary);
			throw new Error("Invalid response format from cancel skill favorite API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to cancel skill favorite:", error);
		throw error;
	}
}

// Sync Skills API
export const syncSkillsRequestSchema = type({
	sandbox_id: "string",
	session_id: "string?",
});
export type SyncSkillsRequest = typeof syncSkillsRequestSchema.infer;

export const syncSkillsResponseSchema = type({
	success: "boolean",
	result: type({
		exit_code: "number",
		stdout: "string",
		stderr: "string",
		error: "string",
	}),
});
export type SyncSkillsResponse = typeof syncSkillsResponseSchema.infer;

/**
 * Sync skills from sandbox
 * - If session_id is empty, updates sandbox built-in skills
 * - If session_id is provided, uploads all skills from session's working directory/.claude/skills as custom skills
 */
export async function syncSkills(request: SyncSkillsRequest): Promise<SyncSkillsResponse> {
	try {
		const kyInstance = await getCodeAgentKy();

		// Local mode doesn't need sandbox_id
		const requestBody = isLocalOrCloudMode()
			? {
					session_id: request.session_id,
				}
			: request;

		const response = await kyInstance
			.post("302/claude-code/skills/sync", {
				json: requestBody,
				timeout: 120000,
			})
			.json();

		const validated = syncSkillsResponseSchema(response);
		if (validated instanceof type.errors) {
			logger.error("Failed to validate sync skills response:", validated.summary);
			throw new Error("Invalid response format from sync skills API");
		}
		return validated;
	} catch (error) {
		logger.error("Failed to sync skills:", error);
		throw error;
	}
}
