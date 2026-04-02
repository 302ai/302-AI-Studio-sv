<script lang="ts">
	import { updateSessionNote } from "$lib/api/sandbox-session";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import { m } from "$lib/paraglide/messages";
	import {
		claudeCodeSandboxState,
		persistedClaudeCodeSandboxState,
	} from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { formatDateTimeFull } from "$lib/utils/date-format";
	import { ExternalLink, Loader2 } from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import type { ClaudeCodeSandboxInfo } from "@shared/storage/code-agent";
	import { toast } from "svelte-sonner";
	import SandboxDeleteConfirmDialog from "./sandbox-delete-confirm-dialog.svelte";
	import SessionDeleteConfirmDialog from "./session-delete-confirm-dialog.svelte";
	import SessionRemarkDialog from "./session-remark-dialog.svelte";

	const logger = createLogger("ui");

	interface Props {
		open?: boolean;
		sandbox?: ClaudeCodeSandboxInfo | null;
		onDelete?: () => void;
		onClose?: () => void;
	}

	type SessionType = {
		sessionId: string;
		workspacePath: string;
		note?: string | null;
		usedAt?: string;
	};

	let {
		open = $bindable(false),
		sandbox = null,
		onDelete = () => {},
		onClose = () => {},
	}: Props = $props();

	let isLoading = $state(false);
	let isDeleteDialogOpen = $state(false);
	let isSessionRemarkDialogOpen = $state(false);
	let isSessionDeleteDialogOpen = $state(false);
	let targetSession = $state<SessionType | null>(null);
	let isOpeningSession = $state<string>("");

	// Get the latest sessions from the persisted state
	const sessions = $derived.by(() => {
		if (!sandbox) return [];
		const currentSandbox = persistedClaudeCodeSandboxState.current.find(
			(s) => s.sandboxId === sandbox.sandboxId,
		);
		return currentSandbox?.sessionInfos || [];
	});

	// Refresh sessions when dialog opens
	$effect(() => {
		if (open && sandbox) {
			(async () => {
				isLoading = true;
				try {
					await claudeCodeSandboxState.refreshSessions(sandbox.sandboxId);
				} finally {
					isLoading = false;
				}
			})();
		}
	});

	// Reset dialog states when main dialog closes
	$effect(() => {
		if (!open) {
			isDeleteDialogOpen = false;
			isSessionRemarkDialogOpen = false;
			isSessionDeleteDialogOpen = false;
			targetSession = null;
		}
	});

	function formatTime(session: { usedAt?: string }) {
		return formatDateTimeFull(session.usedAt);
	}

	function handleModifySessionRemark(session: SessionType) {
		targetSession = session;
		isSessionRemarkDialogOpen = true;
	}

	function handleDeleteSession(session: SessionType) {
		targetSession = session;
		isSessionDeleteDialogOpen = true;
	}

	async function handleConfirmSessionRename(newRemark: string) {
		if (!sandbox || !targetSession) return;

		if (codeAgentState.type !== "remote") {
			toast.error(m.toast_deploy_no_302_provider());
			return;
		}

		const result = await updateSessionNote({
			sandbox_id: sandbox.sandboxId,
			session_id: targetSession.sessionId,
			note: newRemark,
		});

		if (result.success) {
			toast.success(m.update_session_remark_success());

			// Mark isManualNote = true for any thread that uses this session
			try {
				const { codeAgentService } = window.electronAPI;
				await codeAgentService.setIsManualNoteBySession(
					sandbox.sandboxId,
					targetSession.sessionId,
					true,
				);
			} catch (error) {
				logger.error("Failed to update isManualNote:", error);
			}

			// Refresh sessions
			await claudeCodeSandboxState.refreshSessions(sandbox.sandboxId);
		} else {
			toast.error(result.error || m.update_session_remark_failed());
		}
	}

	async function handleConfirmSessionDelete() {
		if (!sandbox || !targetSession) return;
		// The actual deletion is handled by the dialog component
		isSessionDeleteDialogOpen = false;
		// Refresh is handled in the deleteSession method
	}

	async function handleOpenSession(session: SessionType) {
		if (!sandbox || !session) return;
		isOpeningSession = session.sessionId;

		logger.info("Starting, sandbox:", sandbox.sandboxId, "session:", session.sessionId);

		try {
			// Check if there's an existing thread with proper data for this session
			const { isOK, threadId: existingThreadId } =
				await window.electronAPI.codeAgentService.getThreadIdBySessionId(
					sandbox.sandboxId,
					session.sessionId,
				);

			logger.info("getThreadIdBySessionId result:", {
				isOK,
				threadId: existingThreadId,
			});

			// Try to navigate to existing thread first
			if (isOK && existingThreadId) {
				const result =
					await window.electronAPI.windowService.navigateToThread(existingThreadId);
				logger.info("navigateToThread result:", result);

				if (result.success) {
					onClose();
					return;
				}
				// Navigation failed - thread data might be missing, continue to create new
				logger.info("Navigation to existing thread failed, will create new thread");
			}

			// Generate a new thread ID
			const newThreadId = crypto.randomUUID();
			logger.info("Generated new threadId:", newThreadId);

			// Setup the thread with all configurations FIRST (thread data + code agent config + state)
			const setupResult = await window.electronAPI.codeAgentService.createThreadForSession(
				newThreadId,
				sandbox.sandboxId,
				session.sessionId,
				sandbox.sandboxRemark || "",
				sandbox.llmModel || "claude-sonnet-4-5-20250929",
				session.note || "",
				session.workspacePath || "",
			);
			logger.info("createThreadForSession result:", setupResult);

			if (!setupResult.isOK) {
				logger.error("Failed to setup thread");
				toast.error(m.toast_navigate_failed());
				return;
			}

			// Now navigate to the thread in the main window (this will create a new tab there)
			const navResult = await window.electronAPI.windowService.navigateToThread(newThreadId);
			logger.info("navigateToThread result:", navResult);

			if (navResult.success) {
				onClose();
			} else {
				logger.error("Failed to navigate to new thread");
				toast.error(m.toast_navigate_failed());
			}
		} catch (error) {
			logger.error("Failed to open session:", error);
			toast.error(m.toast_navigate_failed());
		} finally {
			isOpeningSession = "";
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="min-w-[568px] rounded-2xl p-6">
		<Dialog.Header>
			<Dialog.Title>
				{sandbox?.sandboxRemark || sandbox?.sandboxId || "Sandbox"}
			</Dialog.Title>
			<Dialog.Description>
				{sandbox?.sandboxId}
			</Dialog.Description>
		</Dialog.Header>

		<!-- Main View -->
		<div>
			<h3 class="text-base font-medium mb-3 text-foreground">
				{m.label_session_list()}
			</h3>

			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			{:else if sessions.length === 0}
				<Empty.Root>
					<Empty.Content class="h-[120px] flex flex-col items-center justify-center">
						<Empty.Description class="text-muted-foreground">
							{m.no_sessions()}
						</Empty.Description>
					</Empty.Content>
				</Empty.Root>
			{:else}
				<div class="space-y-2 max-h-64 overflow-y-auto">
					{#each sessions as session (session.sessionId)}
						<ContextMenu.Root>
							<ContextMenu.Trigger>
								<div
									class="flex items-center justify-between p-4 rounded-xl bg-muted/50 group"
								>
									<div class="flex items-center gap-3 flex-1 min-w-0">
										<div class="min-w-0 flex-1">
											<p class="text-sm font-medium text-foreground">
												{session.note || session.sessionId}
											</p>
											{#if session.note}
												<p class="text-xs text-muted-foreground">
													{session.sessionId}
												</p>
											{/if}
										</div>
									</div>
									<div class="flex items-center gap-2">
										<span class="text-sm text-muted-foreground"
											>{formatTime(session)}</span
										>
										<ButtonWithTooltip
											tooltip={m.tooltip_open_session()}
											variant="ghost"
											size="icon-sm"
											class="opacity-0 group-hover:opacity-100 transition-opacity"
											disabled={isOpeningSession === session.sessionId}
											onclick={() => handleOpenSession(session)}
										>
											{#if isOpeningSession === session.sessionId}
												<Loader2 class="h-4 w-4 animate-spin" />
											{:else}
												<ExternalLink class="h-4 w-4" />
											{/if}
										</ButtonWithTooltip>
									</div>
								</div>
							</ContextMenu.Trigger>
							<ContextMenu.Content>
								<ContextMenu.Item
									onclick={() => handleModifySessionRemark(session)}
								>
									{m.text_button_edit()}
								</ContextMenu.Item>
								<ContextMenu.Item
									class="text-destructive focus:text-destructive"
									onclick={() => handleDeleteSession(session)}
								>
									{m.text_button_delete()}
								</ContextMenu.Item>
							</ContextMenu.Content>
						</ContextMenu.Root>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Footer Buttons -->
		<div class="flex gap-3 mt-6 justify-between">
			<Button
				variant="ghost"
				class="bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive text-sm"
				onclick={() => (isDeleteDialogOpen = true)}
			>
				{m.label_delete_sandbox()}
			</Button>
			<Button variant="outline" class="text-sm" onclick={() => onClose()}>
				{m.btn_close()}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>

<SandboxDeleteConfirmDialog
	bind:open={isDeleteDialogOpen}
	{sandbox}
	onSuccess={() => {
		onClose();
		onDelete();
	}}
/>

<SessionRemarkDialog
	bind:open={isSessionRemarkDialogOpen}
	sessionId={targetSession?.sessionId || ""}
	remark={targetSession?.note || ""}
	onClose={() => (isSessionRemarkDialogOpen = false)}
	onSave={handleConfirmSessionRename}
/>

<SessionDeleteConfirmDialog
	bind:open={isSessionDeleteDialogOpen}
	sandboxId={sandbox?.sandboxId || ""}
	sessionId={targetSession?.sessionId || ""}
	remark={targetSession?.note || ""}
	onClose={() => (isSessionDeleteDialogOpen = false)}
	onConfirm={handleConfirmSessionDelete}
/>
