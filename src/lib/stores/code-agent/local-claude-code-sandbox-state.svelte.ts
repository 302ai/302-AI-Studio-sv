import { deleteLocalSession, listLocalSessions } from "$lib/api/sandbox-session";
import type { GroupedSelectData } from "$lib/components/buss/settings/setting-select.svelte";
import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages";
import { formatDateTimeShort } from "$lib/utils/date-format";
import { createLogger } from "@shared/logger";
import type { LocalSessionInfo } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { SvelteMap } from "svelte/reactivity";

const logger = createLogger("state");

/**
 * Persisted state for local Claude Code sessions.
 */
export const persistedLocalClaudeCodeSessionsState = new PersistedState<LocalSessionInfo[]>(
	"CodeAgentStorage:local-claude-code-sessions-state",
	[],
);

// Trigger reactivity tracking
$effect.root(() => {
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		persistedLocalClaudeCodeSessionsState.current;
	});
});

const newSessionItem = {
	key: "new",
	label: m.local_platform_new_session(),
	value: "new",
};

/**
 * State store for local Claude Code sandbox sessions and workspaces.
 * Manages session/workspace selection with bidirectional linkage.
 */
class LocalClaudeCodeSandboxState {
	// UI selection state
	selectedSessionId = $state("new");
	selectedWorkspacePath = $state("new");

	// Loading state
	isLoading = $state(false);

	// Derived: Sessions from persisted state
	sessions = $derived(persistedLocalClaudeCodeSessionsState.current);

	// Derived: Workspace directories extracted from sessions
	workspaceDirectories = $derived.by(() => {
		const dirs = this.sessions.map((s) => s.workspace_path).filter((dir) => dir !== "");
		return [...new Set(dirs)];
	});

	// Derived: Session options for dropdown
	sessionOptions = $derived.by((): GroupedSelectData => {
		const groupsMap = new SvelteMap<
			string,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ workspacePath: string; maxTimestamp: number; items: any[] }
		>();

		for (const session of this.sessions) {
			const wsPath = session.workspace_path || "No Workspace";
			if (!groupsMap.has(wsPath)) {
				groupsMap.set(wsPath, { workspacePath: wsPath, maxTimestamp: 0, items: [] });
			}

			const group = groupsMap.get(wsPath)!;
			const usedAt = new Date(session.used_at).getTime();
			if (!isNaN(usedAt) && usedAt > group.maxTimestamp) {
				group.maxTimestamp = usedAt;
			}

			group.items.push(session);
		}

		const groups = Array.from(groupsMap.values())
			.map((g) => {
				const date = new Date(g.maxTimestamp);
				const hasValidDate = !isNaN(g.maxTimestamp) && date.getFullYear() > 2020;
				const dateLabel = hasValidDate
					? formatDateTimeShort(g.maxTimestamp)
					: m.local_platform_unknown();

				const groupLabel = `${m.local_platform_work_directory()}: ${g.workspacePath} - ${dateLabel}`;

				return {
					timestamp: g.maxTimestamp,
					groupKey: g.workspacePath,
					groupLabel: groupLabel,
					items: g.items
						.sort(
							(a, b) => new Date(b.used_at).getTime() - new Date(a.used_at).getTime(),
						)
						.map((s) => ({
							value: s.session_id,
							label: s.note || s.session_id,
						})),
				};
			})
			.sort((a, b) => b.timestamp - a.timestamp)
			.map((g) => ({
				groupKey: g.groupKey,
				groupLabel: g.groupLabel,
				items: g.items,
			}));

		return {
			standalone: [newSessionItem],
			groups: groups,
		};
	});

	// Derived: Workspace options for dropdown
	workspaceOptions = $derived.by((): GroupedSelectData => {
		const workspaceMap = new SvelteMap<
			string,
			{ latestUsedAt: number; relatedSessions: { note: string | null; session_id: string }[] }
		>();

		for (const session of this.sessions) {
			if (session.workspace_path && session.workspace_path !== "") {
				if (!workspaceMap.has(session.workspace_path)) {
					workspaceMap.set(session.workspace_path, {
						latestUsedAt: 0,
						relatedSessions: [],
					});
				}
				const data = workspaceMap.get(session.workspace_path)!;
				data.relatedSessions.push({ note: session.note, session_id: session.session_id });

				const usedAtTime = new Date(session.used_at).getTime();
				if (!isNaN(usedAtTime) && usedAtTime > data.latestUsedAt) {
					data.latestUsedAt = usedAtTime;
				}
			}
		}

		const sortedPaths = Array.from(workspaceMap.entries()).sort(
			(a, b) => b[1].latestUsedAt - a[1].latestUsedAt,
		);

		const groupsMap = new SvelteMap<
			string,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ label: string; maxTimestamp: number; items: any[] }
		>();

		for (const [dir, data] of sortedPaths) {
			const date = new Date(data.latestUsedAt);
			const hasValidDate = !isNaN(date.getTime()) && date.getFullYear() > 2020;
			const dateLabel = hasValidDate
				? formatDateTimeShort(data.latestUsedAt)
				: m.local_platform_unknown();

			const sessionLabelRaw = data.relatedSessions
				.map((s) => s.note || m.local_platform_new_session())
				.join(", ");

			// Combine session info and date into group label
			const groupLabel = `${m.local_platform_session({ session: sessionLabelRaw })} - ${dateLabel}`;

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
				value: dir,
				label: dir,
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
			standalone: [{ value: "new", label: m.local_platform_new_work_directory() }],
			groups: groups,
		};
	});

	/**
	 * Refresh sessions from the local container API
	 */
	async refreshSessions(): Promise<void> {
		this.isLoading = true;
		try {
			const response = await listLocalSessions();
			if (response.success) {
				persistedLocalClaudeCodeSessionsState.current = response.session_list;
			}
		} catch (error) {
			logger.error("Failed to refresh sessions:", error);
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Handle session selection with bidirectional linkage.
	 */
	handleSessionSelected(sessionId: string): void {
		this.selectedSessionId = sessionId;
		if (sessionId !== "new") {
			const session = this.sessions.find((s) => s.session_id === sessionId);
			if (session && session.workspace_path) {
				this.selectedWorkspacePath = session.workspace_path;
			}
		}
	}

	/**
	 * Handle workspace selection with bidirectional linkage.
	 */
	handleWorkspaceSelected(workspacePath: string): void {
		this.selectedWorkspacePath = workspacePath;
		this.selectedSessionId = "new";
	}

	/**
	 * Initialize selection state from currently active session/workspace.
	 */
	init(currentSessionId: string, currentWorkspacePath: string): void {
		this.selectedSessionId = currentSessionId === "" ? "new" : currentSessionId;
		this.selectedWorkspacePath = currentWorkspacePath === "" ? "new" : currentWorkspacePath;
	}

	reset(): void {
		this.selectedSessionId = "new";
		this.selectedWorkspacePath = "new";
	}

	/**
	 * Delete a local session
	 */
	async deleteSession(sessionId: string): Promise<boolean> {
		// Find workspace path before deletion (we need it for directory cleanup)
		const session = this.sessions.find((s) => s.session_id === sessionId);
		const workspacePath = session?.workspace_path;

		const result = await deleteLocalSession(sessionId, "local");

		if (result.success) {
			// Delete the local workspace directory if it exists.
			// workspace_path is a container-internal path (e.g. "/home/user/workspace/icr6cz4lnm")
			// We extract the last segment as subPath for the local directory mapping.
			if (workspacePath) {
				// Extract "icr6cz4lnm" from "/home/user/workspace/icr6cz4lnm"
				const segments = workspacePath.replace(/\\/g, "/").split("/").filter(Boolean);
				const subPath = segments[segments.length - 1];
				if (subPath) {
					try {
						await window.electronAPI.codeAgentService.deleteWorkspaceDirectory(subPath);
					} catch (error) {
						logger.error("Failed to delete workspace directory:", subPath, error);
					}
				}
			}

			toast.success(m.delete_session_success());

			// Mark threads using this session as deleted (shows SessionDeleted UI)
			// "local" is the virtual sandboxId used in local mode
			await window.electronAPI.codeAgentService.deleteClaudeCodeSession("local", sessionId);

			await this.refreshSessions();
		} else {
			toast.error(m.delete_session_failed());
		}

		return result.success;
	}
}

export const localClaudeCodeSandboxState = new LocalClaudeCodeSandboxState();
