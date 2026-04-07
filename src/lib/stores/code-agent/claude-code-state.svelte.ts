import { deploySandboxProject, type DeploySandboxResponse } from "$lib/api/sandbox-deploy";
import { updateSessionNote } from "$lib/api/sandbox-session";
import { listSkills } from "$lib/api/skills";
import { type ListSkillsResponse } from "$lib/api/skills/base-apis";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import type { ChatMessage } from "$lib/types/chat";
import { clone } from "$lib/utils/clone";
import { createLogger } from "@shared/logger";
import {
	type CodeAgentMetadata,
	type CodeAgentType,
	type Skill,
	type ThinkingBudgetType,
} from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { match, P } from "ts-pattern";
import { agentPreviewState } from "../agent-preview-state.svelte";
import { persistedClaudeCodeSandboxState } from "./claude-code-sandbox-state.svelte";
import { codeAgentState } from "./code-agent-state.svelte";
import { BUILTIN_SKILLS } from "./constant";
import { persistedLocalClaudeCodeSessionsState } from "./local-claude-code-sandbox-state.svelte";

const logger = createLogger("state");

export interface ClaudeCodeSandboxInfo {
	sandboxId: string;
	sandboxRemark: string;
	llmModel: string;
	diskUsage: "normal" | "insufficient";
}

const {
	checkClaudeCodeSandbox,
	updateClaudeCodeSandboxesByIpc,
	createClaudeCodeSandboxByIpc,
	findClaudeCodeSandboxWithValidDisk,
	updateClaudeCodeSandboxThinkingBudget,
} = window.electronAPI.codeAgentService;

const THINKING_BUDGET_MAP: Record<ThinkingBudgetType, number> = {
	off: 0,
	low: 2000,
	medium: 4000,
	high: 8000,
	max: 16000,
};

const tab = window.tab ?? null;

const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

function getInitialData() {
	if (window.claudeCodeAgentState) {
		return clone(window.claudeCodeAgentState as CodeAgentMetadata);
	}
	const initialData: CodeAgentMetadata = {
		model: "claude-sonnet-4-5-20250929",
		currentWorkspacePath: "",
		variables: [],
		currentSessionId: "",
		sandboxId: "",
		sandboxRemark: "",
		skills: [...BUILTIN_SKILLS],
		thinkingBudget: "off",
		isManualNote: false,
		inPlanMode: false,
	};
	return initialData;
}

export const persistedClaudeCodeAgentState = new PersistedState<CodeAgentMetadata>(
	"CodeAgentStorage:claude-code-agent-state" + "-" + threadId,
	getInitialData(),
);

class ClaudeCodeAgentState {
	baseUrl = "https://api.302.ai/v1";

	customSandboxName = $state("");

	selectedSessionId = $state<"new" | string>("new");
	selectedSessionRemark = $state("");
	selectedSandboxId = $state<"auto" | string>("auto");
	selectedSandboxRemark = $state("");
	selectedWorkspacePath = $state<"new" | string>("new");

	isUpdatingThinkingBudget = $state(false);

	#lastDeployApiError: string | null = null;

	model = $derived(persistedClaudeCodeAgentState.current?.model ?? "");
	currentSessionId = $derived(persistedClaudeCodeAgentState.current?.currentSessionId ?? "");
	sandboxId = $derived(persistedClaudeCodeAgentState.current?.sandboxId ?? "");
	sandboxRemark = $derived(persistedClaudeCodeAgentState.current?.sandboxRemark ?? "");
	skills = $derived(persistedClaudeCodeAgentState.current?.skills ?? []);
	thinkingBudget = $derived(persistedClaudeCodeAgentState.current?.thinkingBudget ?? "off");
	isManualNote = $derived(persistedClaudeCodeAgentState.current?.isManualNote ?? false);
	inPlanMode = $derived(persistedClaudeCodeAgentState.current?.inPlanMode ?? false);

	/**
	 * Determines the agent mode based on the selected session ID.
	 * Returns "new" if the session ID is "new", otherwise returns "existing".
	 */
	agentMode = $derived.by<"new" | "existing">(() => {
		return this.selectedSessionId === "new" ? "new" : "existing";
	});
	currentWorkspacePath = $derived.by<string>(() => {
		return (
			persistedClaudeCodeAgentState.current?.currentWorkspacePath ??
			this.#resolveWorkspacePathFromSession()
		);
	});

	async handleChatFinished({
		canDeploy,
		lastMessage,
		sendRetryMessage,
	}: {
		canDeploy: boolean;
		lastMessage: ChatMessage;
		sendRetryMessage?: (content: string) => Promise<void>;
	}) {
		if (!canDeploy || !lastMessage || lastMessage.role !== "assistant") return;

		let deployInfo: DeploySandboxResponse | null =
			await this.handleActiveDeployment(lastMessage);
		const textDeployInfo = this.parseDeployInfoFromText(lastMessage);
		if (textDeployInfo) {
			deployInfo = textDeployInfo;
		}

		if (deployInfo) {
			await this.finalizeDeployment(deployInfo);
			return;
		}

		// Deploy was attempted but failed — try auto-retry if possible
		if (sendRetryMessage) {
			const errorText =
				this.extractDeployErrorFromMessage(lastMessage) || this.#lastDeployApiError;
			this.#lastDeployApiError = null;

			if (errorText) {
				await this.attemptDeployRetry(errorText, sendRetryMessage);
			}
		}
	}

	private async handleActiveDeployment(
		message: ChatMessage,
	): Promise<DeploySandboxResponse | null> {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const metadata = message.metadata as any;
		if (!metadata?.result?.preDeploy?.success) return null;

		return await match(codeAgentState.type)
			.with("remote", async () => {
				logger.info("Pre-deploy check passed, triggering deployment...");

				if (!this.sandboxId) return null;

				agentPreviewState.isDeploying = true;
				try {
					const result = await deploySandboxProject({
						sandbox_id: this.sandboxId,
						session_id: this.currentSessionId,
					});

					if (result.success) {
						logger.info("Deployment successful:", result);
						return result;
					} else {
						const errorMsg =
							result.error || `Deploy API returned success=false (status: ${result.status})`;
						logger.error("Deployment failed:", result);
						toast.error(`${m.toast_deploy_failed()}`);
						this.#lastDeployApiError = errorMsg;
						return null;
					}
				} catch (error) {
					const errorMsg = String(error);
					logger.error("Deployment error:", error);
					toast.error(`${m.toast_deploy_failed()}: ${errorMsg}`);
					this.#lastDeployApiError = errorMsg;
					return null;
				} finally {
					agentPreviewState.isDeploying = false;
				}
			})
			.otherwise(() => null);
	}

	private parseDeployInfoFromText(message: ChatMessage): DeploySandboxResponse | null {
		const textContent = message.parts
			.filter((part): part is { type: "text"; text: string } => part.type === "text")
			.map((part) => part.text)
			.join("\n");

		if (!textContent.includes("**deploy sandbox successfully**")) {
			return null;
		}

		// Pattern matches: {'success': True, 'status': '...', 'id': '...', 'url': '...', 'cover': '...'}
		const deployInfoRegex =
			/\{[^{}]*'success'\s*:\s*(True|False)[^{}]*'status'\s*:\s*'([^']*)'[^{}]*'id'\s*:\s*'([^']*)'[^{}]*'url'\s*:\s*'([^']*)'[^{}]*'cover'\s*:\s*'([^']*)'\s*\}/;
		const match = textContent.match(deployInfoRegex);

		if (match) {
			const info = {
				success: match[1] === "True",
				status: match[2],
				id: match[3],
				url: match[4],
				cover: match[5],
			};
			logger.info("Parsed deploy info:", info);
			return info;
		}

		return null;
	}

	private async finalizeDeployment(deployInfo: DeploySandboxResponse) {
		await agentPreviewState.setDeploymentInfo(
			this.sandboxId,
			this.currentSessionId,
			deployInfo.url,
			deployInfo.id,
		);
		logger.info("Deploy detected:", { isDeploy: true, deployInfo });
	}

	/**
	 * Extract deploy error text from the assistant message.
	 * First checks metadata (stored by DynamicChatTransport), then falls back
	 * to the `> **Error**: <text>` pattern in message text.
	 */
	private extractDeployErrorFromMessage(message: ChatMessage): string | null {
		// Check metadata for deploy error (stored silently by DynamicChatTransport)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const metadata = message.metadata as any;
		if (metadata?.result?.deployError) {
			return metadata.result.deployError;
		}

		// Fallback: check for error text pattern in message text
		const textContent = message.parts
			.filter((part): part is { type: "text"; text: string } => part.type === "text")
			.map((part) => part.text)
			.join("\n");

		const errorMatch = textContent.match(/> \*\*Error\*\*:\s*(.+)/s);
		return errorMatch ? errorMatch[1].trim() : null;
	}

	/**
	 * Send the deploy error back to the AI model so it can attempt to fix the issue.
	 */
	private async attemptDeployRetry(
		errorText: string,
		sendRetryMessage: (content: string) => Promise<void>,
	): Promise<void> {
		logger.info(
			`[ClaudeCodeAgentState] Sending deploy error to model: ${errorText.slice(0, 200)}`,
		);

		// Delay to let UI settle
		await new Promise((resolve) => setTimeout(resolve, 1500));

		const retryContent = `${m.deploy_retry_prompt()}\n\n${errorText}`;
		await sendRetryMessage(retryContent);
	}

	/**
	 * Get note for the current session, supports local, remote and cloud modes.
	 */
	#getCurrentSessionNote(): string | null {
		return match(codeAgentState.type)
			.with("local", () => {
				const sessionId = this.currentSessionId;
				if (!sessionId) return null;
				const localSessions = persistedLocalClaudeCodeSessionsState.current;
				const session = localSessions.find((s) => s.session_id === sessionId);
				return session?.note ?? null;
			})
			.with("cloud", () => {
				logger.info("[ClaudeCodeAgentState] getCurrentSessionNote: cloud mode placeholder");
				return null;
			})
			.with("remote", () => {
				const sandboxId = this.sandboxId;
				const sessionId = this.currentSessionId;
				const sandbox = persistedClaudeCodeSandboxState.current.find(
					(s) => s.sandboxId === sandboxId,
				);
				if (!sandbox) return null;
				const session = sandbox.sessionInfos.find((s) => s.sessionId === sessionId);
				return session?.note ?? null;
			})
			.exhaustive();
	}

	async handleThreadTitleUpdated({ title }: { title: string }) {
		// If the note was manually set by user, do not overwrite it
		if (this.isManualNote) {
			return;
		}

		// Only auto-update when session note is empty
		// This ensures notes survive cross-device sync (isManualNote is local-only)
		const currentNote = this.#getCurrentSessionNote();
		if (currentNote) {
			return;
		}

		await this.updateSessionRemark(title);
	}

	async updateSessionRemark(remark: string, isManual: boolean = false): Promise<boolean> {
		const { success } = await updateSessionNote({
			note: remark,
			sandbox_id: this.sandboxId,
			session_id: this.currentSessionId,
		});

		if (!success) {
			toast.error(m.error_update_session_note());
			return false;
		} else {
			toast.success(m.update_remark_success());
		}

		// If manually set by user, mark it so auto-generated titles won't overwrite
		if (isManual) {
			this.updateState({ isManualNote: true });
		}

		await updateClaudeCodeSandboxesByIpc();
		return true;
	}

	/**
	 * Fallback: resolve workspace path from session lists for historical threads
	 * where currentWorkspacePath was not persisted.
	 */
	#resolveWorkspacePathFromSession(): string {
		const sessionId = this.currentSessionId;
		if (!sessionId) return "";

		return match(codeAgentState.type)
			.with("local", () => {
				return (
					persistedLocalClaudeCodeSessionsState.current.find(
						(s) => s.session_id === sessionId,
					)?.workspace_path ?? ""
				);
			})
			.with("cloud", () => {
				logger.info(
					"[ClaudeCodeAgentState] resolveWorkspacePathFromSession: cloud mode placeholder",
				);
				return "";
			})
			.with("remote", () => {
				return (
					persistedClaudeCodeSandboxState.current
						.find((s) => s.sandboxId === this.sandboxId)
						?.sessionInfos.find((s) => s.sessionId === sessionId)?.workspacePath ?? ""
				);
			})
			.exhaustive();
	}

	private updateState(partial: Partial<CodeAgentMetadata>): void {
		persistedClaudeCodeAgentState.current = {
			...(persistedClaudeCodeAgentState.current ?? getInitialData()),
			...partial,
		};
	}

	updateCurrentSessionId(sessionId: string): void {
		this.updateState({ currentSessionId: sessionId, isManualNote: false });
	}

	updateCurrentWorkspacePath(workspacePath: string): void {
		this.updateState({ currentWorkspacePath: workspacePath });
	}

	updateSandboxId(sandboxId: string): void {
		this.updateState({ sandboxId });
	}

	/**
	 * Bulk reset session, sandbox ID and workspace path to avoid configuration confusion.
	 */
	resetSessionAndSandbox(type: CodeAgentType): void {
		this.updateState({
			currentSessionId: "",
			sandboxId: type === "remote" ? "" : type,
			currentWorkspacePath: "",
		});
	}

	updateSandboxRemark(sandboxRemark: string): void {
		this.updateState({ sandboxRemark });
	}

	updateSandboxModel(model: string): void {
		this.updateState({ model });
	}

	updateSkills(skills: Skill[]): void {
		this.updateState({ skills });
	}

	updateThinkingBudget(thinkingBudget: ThinkingBudgetType) {
		this.updateState({ thinkingBudget });
	}

	updateInPlanMode(inPlanMode: boolean): void {
		this.updateState({ inPlanMode });
	}

	async handleAgentModeExecute(): Promise<{
		isOK: boolean;
		sandboxInfo?: ClaudeCodeSandboxInfo;
	}> {
		if (this.agentMode === "existing") {
			const { isOK, valid, sandboxInfo } = await checkClaudeCodeSandbox(
				this.selectedSandboxId,
			);
			if (!isOK || !valid) {
				toast.error(m.error_verify_sandbox());
				return { isOK: false };
			}

			this.updateState({
				sandboxId: this.selectedSandboxId,
				sandboxRemark: sandboxInfo?.sandboxRemark,
				currentSessionId: this.selectedSessionId,
			});

			// Update sandbox thinking budget to match current setting
			if (this.thinkingBudget !== "off") {
				await updateClaudeCodeSandboxThinkingBudget(
					this.selectedSandboxId,
					THINKING_BUDGET_MAP[this.thinkingBudget],
				);
			}

			return { isOK: true, sandboxInfo };
		} else if (this.agentMode === "new") {
			if (this.selectedSandboxId === "auto") {
				const { isOK, sandboxInfo } = await findClaudeCodeSandboxWithValidDisk(threadId);
				if (!isOK) {
					toast.error(m.error_verify_sandbox());
					return { isOK: false };
				}

				this.updateState({
					sandboxId: sandboxInfo?.sandboxId,
					sandboxRemark: sandboxInfo?.sandboxRemark,
				});

				// Update sandbox thinking budget to match current setting
				if (this.thinkingBudget !== "off") {
					await updateClaudeCodeSandboxThinkingBudget(
						sandboxInfo!.sandboxId,
						THINKING_BUDGET_MAP[this.thinkingBudget],
					);
				}

				return { isOK: true, sandboxInfo };
			} else {
				const { isOK, valid, sandboxInfo } = await checkClaudeCodeSandbox(
					this.selectedSandboxId,
				);
				if (!isOK || !valid) {
					toast.error(m.error_verify_sandbox());
					return { isOK: false };
				}

				this.updateState({
					sandboxId: this.selectedSandboxId,
					sandboxRemark: sandboxInfo?.sandboxRemark,
				});

				// Update sandbox thinking budget to match current setting
				if (this.thinkingBudget !== "off") {
					await updateClaudeCodeSandboxThinkingBudget(
						this.selectedSandboxId,
						THINKING_BUDGET_MAP[this.thinkingBudget],
					);
				}

				return { isOK: true, sandboxInfo };
			}
		}
		return { isOK: false };
	}

	/**
	 * Handle local mode execution.
	 * Local mode doesn't need sandbox verification - it returns a virtual sandboxInfo
	 * with "local" sandboxId since local mode runs on the user's machine.
	 */
	handleLocalModeExecute(): { isOK: boolean; sandboxInfo: ClaudeCodeSandboxInfo } {
		const sandboxInfo: ClaudeCodeSandboxInfo = {
			sandboxId: codeAgentState.type, // "local" or "cloud"
			sandboxRemark: "",
			llmModel: this.model,
			diskUsage: "normal",
		};

		return { isOK: true, sandboxInfo };
	}

	async handleCreateNewSandbox(): Promise<boolean> {
		const { isOK, sandboxId } = await createClaudeCodeSandboxByIpc(
			threadId,
			this.customSandboxName,
			THINKING_BUDGET_MAP[this.thinkingBudget],
		);
		if (!isOK) {
			toast.error(m.error_create_sandbox());
			return false;
		}

		this.selectedSandboxId = sandboxId;
		toast.success(m.success_create_sandbox());
		return true;
	}

	async listClaudeCodeSkills(isInit: boolean): Promise<ListSkillsResponse> {
		const [selectedSandboxId, selectedSessionId] = [
			this.selectedSandboxId,
			this.selectedSessionId,
		];

		const listSkillsResponse = await listSkills(
			match({ type: codeAgentState.type, sessionId: selectedSessionId })
				.with({ type: "remote", sessionId: P.not("new") }, () => ({
					sandboxId: selectedSandboxId,
					sessionId: selectedSessionId,
				}))
				.with({ type: "cloud" }, () => {
					logger.info("[ClaudeCodeAgentState] listClaudeCodeSkills: cloud mode placeholder");
					return {};
				})
				.otherwise(() => ({})),
		);

		if (isInit) {
			const skillsPineline = (skills: ListSkillsResponse) => {
				return match(codeAgentState.type)
					.with("local", () => {
						const { builtin_skills, user_skills } = skills;
						return [...builtin_skills, ...user_skills];
					})
					.with("cloud", () => {
						logger.info(
							"[ClaudeCodeAgentState] listClaudeCodeSkills (isInit): cloud mode placeholder",
						);
						// Cloud mode initialization placeholder - for now only return builtin skills
						const { builtin_skills } = skills;
						return [...builtin_skills];
					})
					.with("remote", () => {
						const { builtin_skills } = skills;
						return [...builtin_skills];
					})
					.exhaustive();
			};
			this.updateSkills(skillsPineline(listSkillsResponse));
		} else {
			match(codeAgentState.type)
				.with("local", () => {
					const { builtin_skills, user_skills } = listSkillsResponse;
					const allAvailable = [...builtin_skills, ...user_skills];
					const currentSkillNames = new Set(this.skills.map((s) => s.name));
					const newSkills = allAvailable.filter((s) => !currentSkillNames.has(s.name));
					if (newSkills.length > 0) {
						this.handleSkillUse(newSkills);
					}
				})
				.with("cloud", () => {
					logger.info(
						"[ClaudeCodeAgentState] listClaudeCodeSkills (update): cloud mode placeholder",
					);
				})
				.with("remote", () => {
					// No auto-use for remote mode currently
				})
				.exhaustive();
		}

		return listSkillsResponse;
	}

	handleSkillUse(skills: Skill[]): void {
		const currentSkillNames = new Set(this.skills.map((s) => s.name));
		const uniqueNewSkills = skills
			.filter((s) => !currentSkillNames.has(s.name))
			.map((s) => ({ ...s, forceUse: false })); // Default to forceUse=false when enabled
		if (uniqueNewSkills.length > 0) {
			this.updateSkills([...this.skills, ...uniqueNewSkills]);
		}
	}

	handleSkillRemove(skills: Skill[]): void {
		const skillNamesToRemove = new Set(skills.map((s) => s.name));
		const filteredSkills = this.skills.filter((s) => !skillNamesToRemove.has(s.name));
		this.updateSkills(filteredSkills);
	}

	handleSkillForceUseToggle(skillName: string, forceUse: boolean): void {
		const updatedSkills = this.skills.map((s) =>
			s.name === skillName ? { ...s, forceUse } : s,
		);
		this.updateSkills(updatedSkills);
	}

	handleEnabled() {
		const [isExistingMode, sandboxId, sessionId, workspacePath] = [
			this.agentMode === "existing",
			this.selectedSandboxId,
			this.selectedSessionId,
			this.selectedWorkspacePath,
		];

		// Extract actual path from composite key format "sandboxId:path"
		// When "new", keep the pre-generated workspace path from getInitialData()
		const actualWorkspacePath = (() => {
			if (workspacePath === "new") return "";
			const idx = workspacePath.indexOf(":");
			return idx !== -1 ? workspacePath.substring(idx + 1) : workspacePath;
		})();

		const updateData = isExistingMode
			? {
					sandboxId,
					currentSessionId: sessionId,
					currentWorkspacePath: actualWorkspacePath,
				}
			: {
					sandboxId: sandboxId === "auto" ? "" : sandboxId,
					currentSessionId: "",
					currentWorkspacePath: actualWorkspacePath,
				};

		this.updateState(updateData);
	}

	/**
	 * Handle local mode enabled - similar to handleEnabled but for local mode.
	 * Converts selected values from localClaudeCodeSandboxState to current values
	 * and persists them. Local mode doesn't use sandboxId.
	 */
	handleLocalEnabled(sessionId: string, workspacePath: string): void {
		this.updateState({
			currentSessionId: sessionId === "new" ? "" : sessionId,
			currentWorkspacePath: workspacePath === "new" ? "" : workspacePath,
			sandboxId: "local", // Local mode doesn't use sandbox
			isManualNote: false,
		});
	}

	/**
	 * Handle cloud mode enabled - similar to handleEnabled but for cloud mode.
	 * Local mode doesn't use sandboxId.
	 */
	handleCloudEnabled(sessionId: string, workspacePath: string): void {
		this.updateState({
			currentSessionId: sessionId === "new" ? "" : sessionId,
			currentWorkspacePath: workspacePath === "new" ? "" : workspacePath,
			sandboxId: "cloud", // Cloud mode doesn't use sandbox
			isManualNote: false,
		});
	}

	init() {
		const [currentSessionId, sandboxId, currentWorkspacePath] = [
			this.currentSessionId,
			this.sandboxId,
			this.currentWorkspacePath,
		];
		this.selectedSessionId = currentSessionId === "" ? "new" : currentSessionId;
		this.selectedSandboxId = sandboxId === "" ? "auto" : sandboxId;

		// Construct composite key for workspace path so the dropdown can match correctly
		if (currentWorkspacePath === "") {
			this.selectedWorkspacePath = "new";
		} else if (sandboxId && sandboxId !== "" && sandboxId !== "auto") {
			this.selectedWorkspacePath = `${sandboxId}:${currentWorkspacePath}`;
		} else {
			this.selectedWorkspacePath = currentWorkspacePath;
		}
	}
}

export const claudeCodeAgentState = new ClaudeCodeAgentState();
