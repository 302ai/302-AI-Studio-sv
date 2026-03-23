import { deleteSession } from "$lib/api/sandbox-session";
import { validate302Provider } from "$lib/api/webserve-deploy";
import type { GroupedSelectData } from "$lib/components/buss/settings/setting-select.svelte";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import { persistedProviderState } from "$lib/stores/provider-state.svelte";
import { formatDateTimeShort } from "$lib/utils/date-format";
import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { SvelteMap, SvelteSet } from "svelte/reactivity";
import { claudeCodeAgentState } from "./claude-code-state.svelte";
import { codeAgentState } from "./code-agent-state.svelte";
import { persistedLocalClaudeCodeSessionsState } from "./local-claude-code-sandbox-state.svelte";

export const persistedClaudeCodeSandboxState = new PersistedState<ClaudeCodeSandboxInfo[]>(
	"CodeAgentStorage:claude-code-sandbox-state",
	[],
);

const newSessionItem = {
	key: "new",
	label: m.select_session_new(),
	value: "new",
};

const {
	updateClaudeCodeSandboxesByIpc,
	updateClaudeCodeSessions,
	deleteClaudeCodeSandboxByIpc,
	updateClaudeCodeSandboxRemark,
} = window.electronAPI.codeAgentService;

$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedClaudeCodeSandboxState.current;
	});
});

class ClaudeCodeSandboxState {
	sandboxRemarkMap = $state(new SvelteMap<string, string>());

	sandboxes = $derived.by(() => {
		return [
			{
				key: "auto",
				label: m.select_sandbox_auto(),
				value: "auto",
			},
			...persistedClaudeCodeSandboxState.current.map((sandbox) => {
				this.sandboxRemarkMap.set(sandbox.sandboxId, sandbox.sandboxRemark);
				return {
					key: sandbox.sandboxId,
					label: `${sandbox.sandboxId} (${m.remark()}: ${sandbox.sandboxRemark === "" ? m.remark_null() : sandbox.sandboxRemark})`,
					value: sandbox.sandboxId,
				};
			}),
		];
	});

	sessions = $derived.by(() => {
		const sanboxes = persistedClaudeCodeSandboxState.current;
		return [
			newSessionItem,
			...sanboxes
				.flatMap((sandbox) => sandbox.sessionInfos)
				.map((session) => {
					const name = session.note && session.note !== "" ? session.note : session.sessionId;
					// Filter out zero/default dates (e.g. 0001-01-01)
					const date = new Date(session.usedAt);
					const hasValidDate = !isNaN(date.getTime()) && date.getFullYear() > 2020;

					return {
						key: session.sessionId,
						label: name,
						value: session.sessionId,
						extra: hasValidDate ? formatDateTimeShort(session.usedAt) : undefined,
					};
				}),
		];
	});

	groupedSessions = $derived.by(() => {
		const sandboxes = persistedClaudeCodeSandboxState.current;
		const groupsWithMeta = sandboxes.map((sandbox) => {
			const sortedSessions = [...sandbox.sessionInfos].sort(
				(a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime(),
			);

			const latestTimestamp =
				sortedSessions.length > 0 ? new Date(sortedSessions[0].usedAt).getTime() : 0;

			const sandboxLabel = sandbox.sandboxRemark || sandbox.sandboxId;

			return {
				timestamp: latestTimestamp,
				group: {
					groupKey: sandbox.sandboxId,
					groupLabel: sandboxLabel,
					items: sortedSessions.map((session) => {
						const date = new Date(session.usedAt);
						const hasValidDate = !isNaN(date.getTime()) && date.getFullYear() > 2020;
						const dateLabel = hasValidDate
							? formatDateTimeShort(session.usedAt)
							: m.local_platform_unknown();

						return {
							key: session.sessionId,
							label: session.note || session.sessionId,
							value: session.sessionId,
							extra: dateLabel,
						};
					}),
				},
			};
		});

		const sortedGroups = groupsWithMeta
			.sort((a, b) => b.timestamp - a.timestamp)
			.map((g) => g.group);

		return {
			standalone: [newSessionItem],
			groups: sortedGroups,
		};
	});

	/**
	 * Workspace path options for the dropdown
	 */
	workspacePathOptions = $derived.by((): GroupedSelectData => {
		const sandboxList = persistedClaudeCodeSandboxState.current;

		// Map workspacePath to its latest usedAt and related sessions
		const workspaceMap = new SvelteMap<
			string,
			{
				latestUsedAt: number;
				relatedSessions: { note: string | null; sessionId: string }[];
				sandboxId: string;
				sandboxRemark: string;
			}
		>();

		for (const sandbox of sandboxList) {
			for (const session of sandbox.sessionInfos) {
				if (session.workspacePath && session.workspacePath !== "") {
					// Use a composite key to distinguish same paths in different sandboxes
					const compositeKey = `${sandbox.sandboxId}:${session.workspacePath}`;
					if (!workspaceMap.has(compositeKey)) {
						workspaceMap.set(compositeKey, {
							latestUsedAt: 0,
							relatedSessions: [],
							sandboxId: sandbox.sandboxId,
							sandboxRemark: sandbox.sandboxRemark,
						});
					}
					const data = workspaceMap.get(compositeKey)!;
					data.relatedSessions.push({ note: session.note, sessionId: session.sessionId });

					const usedAtTime = new Date(session.usedAt).getTime();
					if (!isNaN(usedAtTime) && usedAtTime > data.latestUsedAt) {
						data.latestUsedAt = usedAtTime;
					}
				}
			}
		}

		// Sort paths by time first (newest first)
		const sortedPaths = Array.from(workspaceMap.entries()).sort(
			(a, b) => b[1].latestUsedAt - a[1].latestUsedAt,
		);

		// Group by combined label
		const groupsMap = new SvelteMap<
			string,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ label: string; maxTimestamp: number; items: any[] }
		>();

		for (const [compositeKey, data] of sortedPaths) {
			const workspacePath = compositeKey.split(":")[1];
			const date = new Date(data.latestUsedAt);
			const hasValidDate = !isNaN(data.latestUsedAt) && date.getFullYear() > 2020;
			const dateLabel = hasValidDate
				? formatDateTimeShort(data.latestUsedAt)
				: m.local_platform_unknown();

			const sessionLabelRaw = [
				...new SvelteSet(data.relatedSessions.map((s) => s.note || m.select_session_new())),
			].join(", ");

			const sandboxLabel = data.sandboxRemark || data.sandboxId;

			// Combine sandbox info, session info and date into group label
			const groupLabel = `${sandboxLabel} - ${m.local_platform_session({ session: sessionLabelRaw })} - ${dateLabel}`;

			if (!groupsMap.has(groupLabel)) {
				groupsMap.set(groupLabel, {
					label: groupLabel,
					maxTimestamp: data.latestUsedAt,
					items: [],
				});
			}

			const group = groupsMap.get(groupLabel)!;
			if (data.latestUsedAt > group.maxTimestamp) {
				group.maxTimestamp = data.latestUsedAt;
			}

			group.items.push({
				key: compositeKey,
				label: workspacePath,
				value: compositeKey,
			});
		}

		const groups = Array.from(groupsMap.values())
			.sort((a, b) => b.maxTimestamp - a.maxTimestamp)
			.map((g) => ({
				groupKey: g.label,
				groupLabel: g.label,
				items: g.items,
			}));

		return {
			standalone: [{ key: "new", label: m.local_platform_new_work_directory(), value: "new" }],
			groups: groups,
		};
	});
	/**
	 * Get the workspace path for the current session
	 * Returns the session's workspacePath if available, empty string otherwise
	 * Supports both Local and Remote modes
	 */
	currentSessionWorkspacePath = $derived.by(() => {
		// Local 模式：从 local sessions 存储中获取
		if (codeAgentState.type === "local") {
			const sessionId = claudeCodeAgentState.currentSessionId;
			if (!sessionId) return "";

			const localSessions = persistedLocalClaudeCodeSessionsState.current;
			const session = localSessions.find((s) => s.session_id === sessionId);
			return session?.workspace_path || "";
		}

		// Remote 模式：原有的逻辑（从 sandbox state 获取）
		const sandboxId = claudeCodeAgentState.sandboxId;
		const sessionId = claudeCodeAgentState.currentSessionId;

		console.log("[ClaudeCodeSandboxState] Computing currentSessionWorkspacePath:", {
			sandboxId,
			sessionId,
			sandboxCount: persistedClaudeCodeSandboxState.current.length,
		});

		const sandbox = persistedClaudeCodeSandboxState.current.find(
			(sandbox) => sandbox.sandboxId === sandboxId,
		);
		if (!sandbox) {
			console.log("[ClaudeCodeSandboxState] Sandbox not found for ID:", sandboxId);
			return "";
		}

		console.log(
			"[ClaudeCodeSandboxState] Found sandbox, sessionInfos count:",
			sandbox.sessionInfos.length,
		);

		const session = sandbox.sessionInfos.find((s) => s.sessionId === sessionId);
		const workspacePath = session?.workspacePath || "";

		console.log("[ClaudeCodeSandboxState] Session workspace path:", {
			sessionId,
			foundSession: !!session,
			workspacePath,
		});

		return workspacePath;
	});

	async refreshSandboxes(): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSandboxesByIpc();
		if (!isOK) {
			toast.error(m.refresh_failed());
		} else {
			toast.success(m.refresh_success());
		}

		return isOK;
	}

	async refreshSessions(sandboxId: string): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSessions(sandboxId);

		if (!isOK) {
			toast.error(m.refresh_sessions_failed());
		}

		return isOK;
	}

	async deleteSandbox(sandboxId: string): Promise<boolean> {
		const { isOK, error } = await deleteClaudeCodeSandboxByIpc(sandboxId);
		if (isOK) {
			toast.success(m.delete_sandbox_success());
		} else {
			toast.error(m.delete_sandbox_failed());
			console.error(error);
		}
		return isOK;
	}

	async updateSandboxRemark(sandboxId: string, remark: string): Promise<boolean> {
		const { isOK } = await updateClaudeCodeSandboxRemark(sandboxId, remark);
		if (isOK) {
			toast.success(m.update_remark_success());
			await this.refreshSandboxes();
		} else {
			toast.error(m.update_remark_failed());
		}
		return isOK;
	}

	async handleSessionSelected(sessionId: string): Promise<void> {
		const sandboxList = persistedClaudeCodeSandboxState.current;

		if (sessionId !== "new") {
			const targetSandbox = sandboxList.find((sandbox) =>
				sandbox.sessionInfos.find((sessionInfo) => sessionInfo.sessionId === sessionId),
			);
			if (targetSandbox) {
				claudeCodeAgentState.selectedSandboxId = targetSandbox.sandboxId;
				claudeCodeAgentState.selectedSandboxRemark = targetSandbox.sandboxRemark;
				claudeCodeAgentState.selectedSessionRemark =
					targetSandbox.sessionInfos.find((sessionInfo) => sessionInfo.sessionId === sessionId)
						?.note || "";

				// Sync workspacePath when selecting a session (use composite key format)
				const session = targetSandbox.sessionInfos.find((s) => s.sessionId === sessionId);
				if (session?.workspacePath) {
					claudeCodeAgentState.selectedWorkspacePath = `${targetSandbox.sandboxId}:${session.workspacePath}`;
				}
			}
		}

		claudeCodeAgentState.selectedSessionId = sessionId;
	}

	async handleSelectSandbox(sandboxId: string): Promise<void> {
		const sandboxList = persistedClaudeCodeSandboxState.current;

		if (sandboxId === "auto") {
			claudeCodeAgentState.selectedSessionId = "new";
			claudeCodeAgentState.selectedSessionRemark = "";
			claudeCodeAgentState.selectedSandboxId = "auto";
			claudeCodeAgentState.selectedSandboxRemark = "";
		} else {
			const targetSandbox = sandboxList.find((sandbox) => sandbox.sandboxId === sandboxId);
			if (targetSandbox) {
				claudeCodeAgentState.selectedSandboxId = targetSandbox.sandboxId;
				claudeCodeAgentState.selectedSandboxRemark = targetSandbox.sandboxRemark;
				claudeCodeAgentState.selectedSessionId = "new";
				claudeCodeAgentState.selectedSessionRemark = "";
			}
		}
	}

	handleWorkspaceSelected(compositeKeyOrNew: string): void {
		if (compositeKeyOrNew === "new") {
			claudeCodeAgentState.selectedWorkspacePath = "new";
			// Sync sandbox to auto when selecting new workspace
			claudeCodeAgentState.selectedSandboxId = "auto";
			claudeCodeAgentState.selectedSandboxRemark = "";
			return;
		}

		// Parse composite key format "sandboxId:workspacePath" to extract sandbox ID
		const separatorIndex = compositeKeyOrNew.indexOf(":");
		if (separatorIndex !== -1) {
			const sandboxId = compositeKeyOrNew.substring(0, separatorIndex);

			// Update workspace path (store the composite key so the dropdown can match)
			claudeCodeAgentState.selectedWorkspacePath = compositeKeyOrNew;

			// Sync sandbox selection to match the workspace's sandbox
			claudeCodeAgentState.selectedSandboxId = sandboxId;
			const sandbox = persistedClaudeCodeSandboxState.current.find(
				(s) => s.sandboxId === sandboxId,
			);
			if (sandbox) {
				claudeCodeAgentState.selectedSandboxRemark = sandbox.sandboxRemark;
			}
		} else {
			claudeCodeAgentState.selectedWorkspacePath = compositeKeyOrNew;
		}
	}

	async deleteSession(sandboxId: string, sessionId: string): Promise<boolean> {
		const providerResult = validate302Provider(persistedProviderState.current);
		if (!providerResult.valid || !providerResult.provider) {
			toast.error(m.toast_no_302_provider_available());
			return false;
		}

		const result = await deleteSession({
			sandbox_id: sandboxId,
			session_id: sessionId,
		});

		if (result.success) {
			toast.success(m.delete_session_success());
			// Cleanup threads using this session
			await window.electronAPI.codeAgentService.deleteClaudeCodeSession(sandboxId, sessionId);
			// Refresh sessions after successful deletion
			await this.refreshSessions(sandboxId);
		} else {
			toast.error(m.delete_session_failed());
		}

		return result.success;
	}
}

export const claudeCodeSandboxState = new ClaudeCodeSandboxState();
