import type { ListSkillsResponse } from "$lib/api/skills/base-apis";
import { emitter, EventNames } from "$lib/event/emitter";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import * as m from "$lib/paraglide/messages";
import { chatState } from "$lib/stores/chat-state.svelte";
import { persistedTabState } from "$lib/stores/tab-bar-state.svelte";
import type { ChatMessage } from "$lib/types/chat";
import { clone } from "$lib/utils/clone";
import type { Model } from "@302ai/studio-plugin-sdk";
import {
	type AgentClass,
	type CodeAgentCfgs,
	type CodeAgentConfigMetadata,
	type CodeAgentSandboxStatus,
	type CodeAgentType,
	type Skill,
	type ThinkingBudgetType,
} from "@shared/storage/code-agent";
import { match } from "ts-pattern";
import { claudeCodeSandboxState } from "./claude-code-sandbox-state.svelte";
import { claudeCodeAgentState, type ClaudeCodeSandboxInfo } from "./claude-code-state.svelte";
import { codeAgentGlobalConfigsState } from "./code-agent-global-configs-state.svelte";
import { codeAgentSendMessageButtonState } from "./code-agent-send-message-button-state.svelte";
import { codeAgentTaskboardState } from "./code-agent-taskboard-state.svelte";
import { localClaudeCodeSandboxState } from "./local-claude-code-sandbox-state.svelte";
import { localEnvState } from "./local-env-state.svelte";
import { withLoadingState } from "./utils";

const tab = window.tab ?? null;
const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";
const tabId =
	tab && typeof tab === "object" && "id" in tab && typeof tab.id === "string" && tab.id
		? tab.id
		: "shell";
const codeAgentConfig = window.codeAgentConfig;

function getInitialData() {
	if (codeAgentConfig) {
		return clone(codeAgentConfig as CodeAgentConfigMetadata);
	}
	const initialData: CodeAgentConfigMetadata = {
		enabled: false,
		threadId: threadId,
		type: "remote",
		currentAgentId: "claude-code",
		codingAgentId: "claude-code",
		isDeleted: false,
	};
	return initialData;
}

export const persistedCodeAgentConfigState = new PersistedState<CodeAgentConfigMetadata>(
	"CodeAgentStorage:code-agent-config-state" + "-" + threadId,
	getInitialData(),
);

const { updateClaudeCodeSandboxModel } = window.electronAPI.codeAgentService;
const { notifyTaskCompleted } = window.electronAPI.notificationService;

class CodeAgentState {
	isCodeAgentPanelOpen = $state(false);
	isSkillsPanelOpen = $state(false);
	isLoadingSkills = $state(false);
	isUpdatingSandboxRemark = $state(false);
	isUpdatingSessionRemark = $state(false);
	localBaseUrl = $state("");

	enabled = $derived.by(() => persistedCodeAgentConfigState.current?.enabled ?? false);
	type = $derived.by(() => {
		if (threadId === "shell") return "remote";
		return persistedCodeAgentConfigState.current?.type ?? "remote";
	});
	currentAgentId = $derived.by(
		() => persistedCodeAgentConfigState.current?.currentAgentId ?? "claude-code",
	);
	codingAgentId = $derived.by(() =>
		(persistedCodeAgentConfigState.current?.codingAgentId ?? this.currentAgentId === "open-claw")
			? "claude-code"
			: this.currentAgentId,
	);
	isDeleted = $derived.by(() => persistedCodeAgentConfigState.current?.isDeleted ?? false);
	// inPlanMode = $derived.by(() => persistedCodeAgentConfigState.current?.inPlanMode ?? false);

	isFreshTab = $derived(!chatState.hasMessages);
	inCodeAgentMode = $derived(!this.isFreshTab && this.enabled);
	isChecking = $derived(codeAgentSendMessageButtonState.isChecking);

	async refreshLocalBaseUrl() {
		try {
			const url = await window.electronAPI.localVibeService.getLocalBaseUrl();
			if (url) {
				this.localBaseUrl = url + "/api/v1";
			}
		} catch (error) {
			console.error("[CodeAgentState] Failed to refresh local base URL:", error);
		}
	}

	sandboxStatus = $derived.by<CodeAgentSandboxStatus>(() => {
		return match(this.currentAgentId)
			.with("claude-code", () =>
				claudeCodeAgentState.sandboxId === "" ? "waiting-for-sandbox" : "sandbox-created",
			)
			.otherwise(() => "waiting-for-sandbox");
	});

	handleChatFinished = async (event: { canDeploy: boolean; lastMessage: ChatMessage }) => {
		// Skip deployment if taskboard is still running - deployment will be triggered when all tasks complete
		if (codeAgentTaskboardState.isRunning) {
			return;
		}

		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			const sendRetryMessage = codeAgentGlobalConfigsState.autoFixDeployFailure
				? async (content: string) => {
						await chatState.sendMessage({ content });
					}
				: undefined;

			await claudeCodeAgentState.handleChatFinished({
				...event,
				sendRetryMessage,
			});
		}

		// Send notification if in Vibe mode and tab is inactive
		await this.#showNotificationForChatFinished(event);
	};

	handleThreadTitleUpdated = async (event: { title: string }) => {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			await claudeCodeAgentState.handleThreadTitleUpdated(event);
			if (this.type === "local") {
				await localClaudeCodeSandboxState.refreshSessions();
			}
		}
	};

	handleTaskboardAllTasksDone = async (_event: {
		sandboxId: string;
		sessionId: string;
		taskCount: number;
	}) => {
		// Only trigger deployment if auto-deploy is enabled and current agent is claude-code
		if (this.currentAgentId === "claude-code" && codeAgentGlobalConfigsState.autoDeploy) {
			// Get the last message for deployment check
			const lastMessage = chatState.messages[chatState.messages.length - 1];
			if (lastMessage) {
				await claudeCodeAgentState.handleChatFinished({
					canDeploy: true, // Explicitly allow deployment when taskboard completes
					lastMessage,
				});
			}
		}

		// Send notification if in Vibe mode and tab is inactive
		await this.#showNotificationForTaskboardDone(_event);
	};

	// Check if current tab is inactive by looking at the persisted tab state
	#isCurrentTabInactive(): boolean {
		const current = persistedTabState.current;
		if (!current) return true;

		// Find our tab across all windows
		for (const windowId of Object.keys(current)) {
			const windowState = current[windowId];
			if (!windowState?.tabs) continue;

			const currentTab = windowState.tabs.find((t) => t.threadId === threadId);
			if (currentTab) {
				return !currentTab.active;
			}
		}

		// If we can't find the tab, assume it's inactive
		return true;
	}

	// Extract a summary from the last message for notification body
	#extractTaskSummary(lastMessage: ChatMessage | undefined): string {
		if (!lastMessage) return "";

		// Extract content from metadata.result.content (302.AI Claude Code result)
		const resultContent = lastMessage.metadata?.result?.content ?? "";

		// Get first 100 characters as summary
		const summary = resultContent.slice(0, 100).trim();
		return summary.length >= 100 ? summary + "..." : summary;
	}

	// Show notification for CHAT_FINISHED event
	async #showNotificationForChatFinished(event: {
		canDeploy: boolean;
		lastMessage: ChatMessage;
	}): Promise<void> {
		// Only notify if Vibe mode is enabled and tab is inactive OR document is hidden (window backgrounded)
		if (
			this.enabled &&
			(this.#isCurrentTabInactive() || document.hidden) &&
			codeAgentGlobalConfigsState.notificationsEnabled
		) {
			const summary = this.#extractTaskSummary(event.lastMessage);
			await notifyTaskCompleted({
				title: m.notification_vibe_task_completed_title(),
				body: summary,
				windowId: window.windowId,
				tabId: tabId,
			});
		}
	}

	// Show notification for TASKBOARD_ALL_TASKS_DONE event
	async #showNotificationForTaskboardDone(event: { taskCount: number }): Promise<void> {
		// Only notify if Vibe mode is enabled and tab is inactive OR document is hidden (window backgrounded)
		if (
			this.enabled &&
			(this.#isCurrentTabInactive() || document.hidden) &&
			codeAgentGlobalConfigsState.notificationsEnabled
		) {
			const lastMessage = chatState.messages[chatState.messages.length - 1];
			const summary = this.#extractTaskSummary(lastMessage);

			await notifyTaskCompleted({
				title: m.notification_vibe_taskboard_completed_title(),
				body: `${m.notification_vibe_taskboard_completed_body({ count: event.taskCount })}${summary ? "\n" + summary : ""}`,
				windowId: window.windowId,
				tabId: tabId,
			});
		}
	}

	private updateState(partial: Partial<CodeAgentConfigMetadata>): void {
		persistedCodeAgentConfigState.current = {
			...(persistedCodeAgentConfigState.current ?? getInitialData()),
			...partial,
		};
	}

	updateCurrentAgentId(agentId: AgentClass): void {
		const codingAgentId = agentId === "open-claw" ? "claude-code" : agentId;
		this.updateState({ currentAgentId: agentId, codingAgentId });
	}

	updateType(type: CodeAgentType): void {
		this.updateState({ type });
		// 切换模式时重置 session 和 sandbox ID，避免配置混乱和竞态问题
		claudeCodeAgentState.resetSessionAndSandbox(type);
		// 重置 local session 选择
		localClaudeCodeSandboxState.reset();
	}

	updateEnabled(enabled: boolean, shouldReset = true): void {
		this.updateState({ enabled });
		if (shouldReset) {
			claudeCodeAgentState.resetSessionAndSandbox(this.type);

			localClaudeCodeSandboxState.reset();
		}
	}

	updateInPlanMode(inPlanMode: boolean): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.updateInPlanMode(inPlanMode);
		}
	}

	async executeCodeAgentMode(): Promise<{ isOK: boolean; sandboxInfo?: ClaudeCodeSandboxInfo }> {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			// Local mode: skip sandbox verification, return virtual sandboxInfo
			if (this.type === "local") {
				return claudeCodeAgentState.handleLocalModeExecute();
			}
			// Remote mode: verify sandbox and return real sandboxInfo
			return claudeCodeAgentState.handleAgentModeExecute();
		}
		return { isOK: false };
	}

	updateCurrentSessionId(sessionId: string): void {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.updateCurrentSessionId(sessionId);
		}
	}

	get codeAgentCfgs(): CodeAgentCfgs {
		return match(this.currentAgentId)
			.with("claude-code", "open-claw", () => {
				if (this.type === "local") {
					return {
						baseUrl: this.localBaseUrl,
						model: claudeCodeAgentState.model,
					};
				}
				return {
					baseUrl: claudeCodeAgentState.baseUrl,
					model: claudeCodeAgentState.sandboxId,
				};
			})
			.otherwise(() => ({ baseUrl: "", model: "" }));
	}

	get inPlanMode(): boolean {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.inPlanMode)
			.otherwise(() => false);
	}

	get currentSessionId(): string {
		return match(this.currentAgentId)
			.with("claude-code", "open-claw", () => claudeCodeAgentState.currentSessionId)
			.otherwise(() => "");
	}

	get sandboxId(): string {
		return match(this.currentAgentId)
			.with("claude-code", "open-claw", () => claudeCodeAgentState.sandboxId)
			.otherwise(() => "");
	}

	get sessionId(): string {
		return match(this.currentAgentId)
			.with("claude-code", "open-claw", () => claudeCodeAgentState.currentSessionId)
			.otherwise(() => "");
	}

	get currentModel(): string {
		return match(this.currentAgentId)
			.with("claude-code", "open-claw", () => claudeCodeAgentState.model)
			.otherwise(() => "");
	}

	get currentWorkspacePath(): string {
		return match(this.currentAgentId)
			.with("claude-code", "open-claw", () => claudeCodeAgentState.currentWorkspacePath)
			.otherwise(() => "");
	}

	get skills(): Skill[] {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.skills)
			.otherwise(() => []);
	}

	get thinkingBudget(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.thinkingBudget)
			.otherwise(() => "off");
	}

	get isUpdatingThinkingBudget(): boolean {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.isUpdatingThinkingBudget)
			.otherwise(() => false);
	}

	async getSkillList(isInit: boolean): Promise<ListSkillsResponse> {
		return withLoadingState(
			(loading) => (this.isLoadingSkills = loading),
			() =>
				match(this.currentAgentId)
					.with("claude-code", () => claudeCodeAgentState.listClaudeCodeSkills(isInit))
					.otherwise(() => ({
						success: false,
						user_skills: [],
						builtin_skills: [],
						project_skills: [],
					})),
		);
	}
	async handleCodeAgentModelChange(model: Model): Promise<boolean> {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			const { isOK } = await updateClaudeCodeSandboxModel(threadId, this.sandboxId, model.id);
			return isOK;
		}

		return false;
	}

	updateSandboxModel(model: string): void {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.updateSandboxModel(model);
		}
	}

	updateThinkingBudget(thinkingBudget: ThinkingBudgetType): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.updateThinkingBudget(thinkingBudget);
		}
	}

	handleSkillsUse(skills: Skill[]): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.handleSkillUse(skills);
		}
	}

	handleSkillsRemove(skills: Skill[]): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.handleSkillRemove(skills);
		}
	}

	async updateSandboxRemark(remark: string): Promise<boolean> {
		return withLoadingState(
			(loading) => (this.isUpdatingSandboxRemark = loading),
			() =>
				match(this.currentAgentId)
					.with("claude-code", "open-claw", () =>
						claudeCodeSandboxState.updateSandboxRemark(claudeCodeAgentState.sandboxId, remark),
					)
					.otherwise(() => false),
		);
	}

	async updateSessionRemark(remark: string): Promise<boolean> {
		return withLoadingState(
			(loading) => (this.isUpdatingSessionRemark = loading),
			async () => {
				const isOK = await match(this.currentAgentId)
					.with("claude-code", "open-claw", () =>
						claudeCodeAgentState.updateSessionRemark(remark, true),
					)
					.otherwise(() => false);

				if (isOK && this.type === "local") {
					await localClaudeCodeSandboxState.refreshSessions();
				}

				return isOK;
			},
		);
	}

	handleSkillForceUseToggle(skillName: string, forceUse: boolean): void {
		if (this.currentAgentId === "claude-code") {
			claudeCodeAgentState.handleSkillForceUseToggle(skillName, forceUse);
		}
	}

	// --- Proxy getters for properties accessed by external consumers ---

	get sandboxRemark(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.sandboxRemark)
			.otherwise(() => "");
	}

	get agentMode(): "new" | "existing" {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.agentMode)
			.otherwise(() => "new");
	}

	// --- Proxy methods for operations accessed by external consumers ---

	updateCurrentWorkspacePath(workspacePath: string): void {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.updateCurrentWorkspacePath(workspacePath);
		}
	}

	init(): void {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.init();
		}
	}

	handleEnabled(): void {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.handleEnabled();
		}
	}

	handleLocalEnabled(sessionId: string, workspacePath: string): void {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.handleLocalEnabled(sessionId, workspacePath);
		}
	}

	async handleCreateNewSandbox(): Promise<boolean> {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			return claudeCodeAgentState.handleCreateNewSandbox();
		}
		return false;
	}

	// --- Proxy getter/setter for UI form state (used via bind in components) ---

	get selectedSandboxId(): string {
		return match(this.currentAgentId)
			.with("claude-code", "open-claw", () => claudeCodeAgentState.selectedSandboxId)
			.otherwise(() => "auto");
	}
	set selectedSandboxId(value: string) {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.selectedSandboxId = value;
		}
	}

	get selectedSandboxRemark(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.selectedSandboxRemark)
			.otherwise(() => "");
	}
	set selectedSandboxRemark(value: string) {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.selectedSandboxRemark = value;
		}
	}

	get selectedSessionId(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.selectedSessionId)
			.otherwise(() => "new");
	}
	set selectedSessionId(value: string) {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.selectedSessionId = value;
		}
	}

	get selectedWorkspacePath(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.selectedWorkspacePath)
			.otherwise(() => "new");
	}
	set selectedWorkspacePath(value: string) {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.selectedWorkspacePath = value;
		}
	}

	get customSandboxName(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.customSandboxName)
			.otherwise(() => "");
	}
	set customSandboxName(value: string) {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.customSandboxName = value;
		}
	}

	get selectedSessionRemark(): string {
		return match(this.currentAgentId)
			.with("claude-code", () => claudeCodeAgentState.selectedSessionRemark)
			.otherwise(() => "");
	}
	set selectedSessionRemark(value: string) {
		if (this.currentAgentId === "claude-code" || this.currentAgentId === "open-claw") {
			claudeCodeAgentState.selectedSessionRemark = value;
		}
	}
}

export const codeAgentState = new CodeAgentState();

$effect.root(() => {
	$effect(() => {
		if (codeAgentState.enabled) {
			const offChat = emitter.on(EventNames.CHAT_FINISHED, codeAgentState.handleChatFinished);
			const offTitle = emitter.on(
				EventNames.THREAD_TITLE_UPDATED,
				codeAgentState.handleThreadTitleUpdated,
			);
			const offTaskboard = emitter.on(
				EventNames.TASKBOARD_ALL_TASKS_DONE,
				codeAgentState.handleTaskboardAllTasksDone,
			);

			return () => {
				offChat();
				offTitle();
				offTaskboard();
			};
		}
	});

	// Auto-refresh local baseUrl when mode is local and sandbox is running
	// This handles both scenarios:
	// 1. Current tab: when sandbox state changes from not running to running
	// 2. New tab: when the tab opens and sandbox is already running
	$effect(() => {
		if (codeAgentState.type === "local" && localEnvState.sandboxRunning) {
			codeAgentState.refreshLocalBaseUrl();
		}
	});

	// Auto-start sandbox health check listening when local Vibe mode is active.
	// This ensures cron job monitoring starts for threads loaded from the sidebar
	// without requiring the user to open the Vibe mode settings panel.
	// startSandboxListening() is idempotent (guarded by unsubscribe checks).
	$effect(() => {
		if (codeAgentState.enabled && codeAgentState.type === "local") {
			localEnvState.startSandboxListening();
		}
	});

	// Listen to local sandbox state changes, refresh baseUrl when sandbox is running
	const offLocalSandboxState = window.electronAPI.onLocalSandboxStateChanged((data) => {
		if (data.running && codeAgentState.type === "local") {
			codeAgentState.refreshLocalBaseUrl();
		}
	});

	return () => {
		offLocalSandboxState();
	};
});
