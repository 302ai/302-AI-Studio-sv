import {
	_getTasklist,
	updateTasklist,
	uploadAttachments,
	type Attachment,
} from "$lib/api/vibe-mode";
import { emitter, EventNames } from "$lib/event/emitter";
import { m } from "$lib/paraglide/messages";
import type { ChatMessage } from "$lib/types/chat";
import {
	addAttachmentReference,
	removeAttachmentReference,
} from "$lib/utils/attachment-text-utils";
import { createLogger } from "@shared/logger";
import type { AttachmentFile, Task } from "@shared/types";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";
import { match } from "ts-pattern";
import { chat, chatState } from "../chat-state.svelte";
import { codeAgentState } from "./code-agent-state.svelte";
import { shouldPauseAfterTaskRestore } from "./taskboard-auto-execution-policy";
import { withLoadingState } from "./utils";

const logger = createLogger("state");

export class CodeAgentTaskboardState {
	#currentRetryCount = 0;
	readonly #MAX_RETRY_COUNT = 3;
	#autoExecutionHandler: ((content: string) => Promise<boolean>) | null = null;

	isLoading = $state(false);
	tasklist = $state<Task[]>([]);
	taskboardStatus = $state<"idle" | "running" | "waiting_to_stop" | "waiting_for_chat">("idle");
	retryExhausted = $state(false);
	isAutoPaused = $state(false);

	// Input state
	inputValue = $state("");
	attachments = $state<AttachmentFile[]>([]);
	repeatCount = $state(1);

	// Pending attachments queue (for when sandbox is not yet initialized)
	pendingAttachments = $state<AttachmentFile[]>([]);

	currentExecutingTaskId = $state<string | null>(null);

	#taskResolve: ((success: boolean) => void) | null = null;

	inProgressTask = $derived<Task | null>(
		this.tasklist.find((task) => task.status === "in_progress") ?? null,
	);

	activeTask = $derived.by(() => {
		if (this.taskboardStatus === "running" || this.taskboardStatus === "waiting_to_stop") {
			return (
				this.tasklist.find((t) => t.status === "in_progress") ??
				this.tasklist.find((t) => t.status === "pending")
			);
		}
		return this.tasklist.find((t) => t.status === "pending");
	});

	canStart = $derived(
		(this.taskboardStatus === "idle" || this.taskboardStatus === "waiting_for_chat") &&
			this.tasklist.some((t) => t.status === "pending"),
	);
	canPause = $derived(this.taskboardStatus === "running");
	isWaitingToStop = $derived(this.taskboardStatus === "waiting_to_stop");
	isWaitingForChat = $derived(this.taskboardStatus === "waiting_for_chat");
	// Whether taskboard is currently executing (used to prevent premature auto-deployment)
	isRunning = $derived(this.taskboardStatus === "running");
	showTaskboardStatusBar = $derived(
		this.tasklist.some((t) => t.status === "in_progress") ||
			this.tasklist.some((t) => t.status === "pending"),
	);

	buttonText = $derived.by(() => {
		return match(this.taskboardStatus)
			.with("running", () => m.taskboard_button_pause())
			.with("waiting_to_stop", () => m.taskboard_button_waiting_to_stop())
			.with("waiting_for_chat", () => m.taskboard_button_waiting_for_chat())
			.with("idle", () => {
				if (this.isAutoPaused) return m.taskboard_button_resume();
				if (this.tasklist.some((t) => t.status === "in_progress"))
					return m.taskboard_button_resume();
				return m.taskboard_button_run();
			})
			.exhaustive();
	});

	toggleTaskboardRunningStatus() {}

	stopExecution() {
		this.taskboardStatus = "idle";
		this.isAutoPaused = true;
		if (this.currentExecutingTaskId) {
			this.#updateTaskStatus(this.currentExecutingTaskId, { status: "pending" });
		}
	}

	/**
	 * Cancels the waiting for chat state.
	 */
	cancelWaitingForChat() {
		if (this.taskboardStatus === "waiting_for_chat") {
			this.taskboardStatus = "idle";
			this.isAutoPaused = true;
		}
	}

	registerExecutionHandler(fn: ((content: string) => Promise<boolean>) | null) {
		this.#autoExecutionHandler = fn;
		void this.autoStartIfPossible();
	}

	async autoStartIfPossible(): Promise<void> {
		if (!this.#autoExecutionHandler) return;
		if (codeAgentState.inPlanMode) return;

		const hasPendingTasks = this.tasklist.some((t) => t.status === "pending");
		if (!hasPendingTasks && this.taskboardStatus === "idle" && this.isAutoPaused) {
			this.isAutoPaused = false;
			return;
		}

		if (
			this.taskboardStatus !== "idle" ||
			this.isAutoPaused ||
			this.retryExhausted ||
			!hasPendingTasks
		) {
			return;
		}

		await this.#beginExecution(this.#autoExecutionHandler);
	}

	// ==================== Input Methods ====================

	/**
	 * Adds a new task from the current input value and attachments.
	 */
	addTaskFromInput() {
		if (this.inputValue.trim() || this.attachments.length > 0) {
			if (this.inputValue.trim()) {
				const newTask: Task = {
					id: nanoid(),
					content: this.inputValue.trim(),
					status: "pending",
					number: Math.min(
						99,
						Math.max(1, Number.parseInt(`${this.repeatCount}`, 10) || 1),
					),
					executedCount: 0,
				};
				const updatedTasklist = [...this.tasklist, newTask];
				this.updateTasklist(updatedTasklist);
			}
			this.inputValue = "";
			this.attachments = [];
			this.repeatCount = 1;
		}
	}

	/**
	 * Adds a new task from chat input content (used for redirection during streaming).
	 * Does NOT clear any input state - caller handles that.
	 * Attachments are queued to pendingAttachments for deferred upload when sandbox initializes.
	 */
	addTaskFromChatInput(payload: { content: string; attachments?: AttachmentFile[] }) {
		const { content, attachments = [] } = payload;
		const trimmedContent = content.trim();
		// Allow task creation if there's content OR attachments
		if (!trimmedContent && attachments.length === 0) return;

		// Build attachment references for task content
		const ATTACHMENTS_DIR_PATH = ".302ai/attachments";
		const attachmentRefs =
			attachments.length > 0
				? attachments
						.map((att) => `[Attachment: ${ATTACHMENTS_DIR_PATH}/${att.name}]`)
						.join("\n")
				: "";
		const taskContent = attachmentRefs
			? trimmedContent
				? `${trimmedContent}\n\n${attachmentRefs}`
				: attachmentRefs
			: trimmedContent;

		// Queue attachments for upload (processed when sandbox initializes)
		if (attachments.length > 0) {
			this.addPendingAttachments(attachments);
		}

		const newTask: Task = {
			id: nanoid(),
			content: taskContent,
			status: "pending",
			number: 1,
			executedCount: 0,
		};
		this.updateTasklist([...this.tasklist, newTask]);
	}

	/**
	 * Adds multiple tasks from an array of task content strings.
	 * Used by the AI task decomposition feature.
	 */
	addMultipleTasks(taskContents: string[]) {
		if (taskContents.length === 0) return;

		const newTasks: Task[] = taskContents.map((content) => ({
			id: nanoid(),
			content: content.trim(),
			status: "pending" as const,
			number: 1,
			executedCount: 0,
		}));

		const updatedTasklist = [...this.tasklist, ...newTasks];
		this.updateTasklist(updatedTasklist);
	}

	/**
	 * Adds an attachment to the list.
	 */
	addAttachment(attachment: AttachmentFile) {
		this.attachments = [...this.attachments, attachment];
		this.inputValue = addAttachmentReference(this.inputValue, attachment.name);
	}

	/**
	 * Updates an attachment by id.
	 */
	updateAttachment(id: string, updates: Partial<AttachmentFile>) {
		this.attachments = this.attachments.map((a) => (a.id === id ? { ...a, ...updates } : a));
	}

	/**
	 * Removes an attachment by id.
	 */
	removeAttachment(id: string) {
		const attachment = this.attachments.find((a) => a.id === id);
		if (attachment) {
			this.inputValue = removeAttachmentReference(this.inputValue, attachment.name);
		}
		this.attachments = this.attachments.filter((a) => a.id !== id);
	}

	/**
	 * Adds attachments to the pending queue (for when sandbox is not yet initialized).
	 */
	addPendingAttachments(attachments: AttachmentFile[]) {
		this.pendingAttachments = [...this.pendingAttachments, ...attachments];
	}

	/**
	 * Clears the pending attachments queue.
	 */
	clearPendingAttachments() {
		this.pendingAttachments = [];
	}

	/**
	 * Helper function to convert file to base64.
	 */
	#fileToBase64(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				const result = reader.result as string;
				resolve(result);
			};
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	/**
	 * Uploads pending attachments after sandbox initialization.
	 */
	async uploadPendingAttachments(sandboxId: string, workspacePath: string): Promise<void> {
		if (this.pendingAttachments.length === 0) return;

		try {
			const attachmentList: Attachment[] = await Promise.all(
				this.pendingAttachments.map(async (att) => ({
					filename: att.name,
					content: att.file ? await this.#fileToBase64(att.file) : "",
				})),
			);

			const result = await uploadAttachments(sandboxId, workspacePath, attachmentList);
			if (!result.isOk) {
				toast.error(m.taskboard_error_attachment_upload_failed());
			}
		} catch (error) {
			logger.error("Failed to upload pending attachments:", error);
			toast.error(m.taskboard_error_attachment_upload_failed());
		} finally {
			this.clearPendingAttachments();
		}
	}

	/**
	 * Synchronizes the tasklist with the backend.
	 * If the taskboard is not initialized, it will fetch the tasklist from the backend.
	 * Otherwise, it will use an empty array.
	 */
	async syncTasklist(): Promise<void> {
		await withLoadingState(
			(loading) => (this.isLoading = loading),
			async () => {
				await match(codeAgentState.isPristineSession)
					.with(true, () => this.tasklist)
					.otherwise(async () => {
						const [sandboxId, path] = [
							codeAgentState.sandboxId,
							codeAgentState.currentWorkspacePath,
						];

						if (path) {
							const hadLocalTasksBeforeSync = this.tasklist.length > 0;
							const { isOk, tasks } = await _getTasklist(sandboxId, path);

							// Strategy: Prefer local data if remote is suspiciously empty/corrupted
							if (isOk) {
								if (tasks.length === 0 && this.tasklist.length > 0) {
									// Remote is empty, but we have local data.
									// Assume remote might be corrupted/reset, so we repair it with local data.
									logger.warn(
										"Remote tasklist is empty but local has data. Repairing remote with local data.",
									);
									await this.updateTasklist(this.tasklist);
								} else {
									// Remote has data, or both are empty. Trust remote.
									const sortedTasks = this.#sortTasks(tasks);
									this.tasklist = sortedTasks;
									this.#reconcileWaitingForChatStatus(sortedTasks);

									if (
										shouldPauseAfterTaskRestore({
											hadLocalTasksBeforeSync,
											taskboardStatus: this.taskboardStatus,
											restoredTasks: sortedTasks,
										})
									) {
										this.isAutoPaused = true;
									}
								}
							} else {
								// Get failed completely.
								// If we have local data, try to push it to remote to fix the issue.
								if (this.tasklist.length > 0) {
									logger.warn(
										"Failed to get tasklist. Attempting to restore from local state.",
									);
									await this.updateTasklist(this.tasklist);
								}
							}
						}
					});
			},
		);
	}

	/**
	 * Updates the tasklist in the backend.
	 * If the taskboard is not initialized, it will update the tasklist in the backend.
	 * Otherwise, it will use the provided tasklist.
	 */
	async updateTasklist(tasklist: Task[]): Promise<void> {
		const sortedTasklist = this.#sortTasks(tasklist);

		match(codeAgentState.isPristineSession)
			.with(true, () => {
				this.tasklist = sortedTasklist;
				this.#reconcileWaitingForChatStatus(sortedTasklist);
			})
			.otherwise(async () => {
				this.tasklist = sortedTasklist;
				this.#reconcileWaitingForChatStatus(sortedTasklist);
				const [sandboxId, path] = [
					codeAgentState.sandboxId,
					codeAgentState.currentWorkspacePath,
				];
				logger.debug("Updating tasklist", path);

				const result = await updateTasklist(sandboxId, path, sortedTasklist);
				if (!result.isOk) {
					const { isOk, tasks } = await _getTasklist(sandboxId, path);
					this.tasklist = isOk ? this.#sortTasks(tasks) : [];
					this.#reconcileWaitingForChatStatus(this.tasklist);

					toast.error(m.taskboard_update_failed());
				}
			});
	}

	/**
	 * Starts the auto execution of tasks.
	 */
	async startAutoExecution(fn: (content: string) => Promise<boolean>): Promise<void> {
		match(this.taskboardStatus)
			.with("running", () => {
				// 正在运行时点击 -> 暂停
				this.isAutoPaused = true;
				this.taskboardStatus = "waiting_to_stop";
			})
			.with("waiting_to_stop", () => {
				// 暂停中点击 -> 恢复运行
				this.isAutoPaused = false;
				this.taskboardStatus = "running";
			})
			.with("waiting_for_chat", () => {
				// 等待聊天中点击 -> 取消等待
				this.taskboardStatus = "idle";
				this.isAutoPaused = true;
			})
			.with("idle", async () => {
				// 空闲时点击 -> 检查是否需要等待聊天
				this.isAutoPaused = false;
				await this.#beginExecution(fn);
			});
	}

	/**
	 * Begins execution flow from idle state.
	 */
	async #beginExecution(fn: (content: string) => Promise<boolean>): Promise<void> {
		if (chatState.isStreaming || chatState.isSubmitted) {
			// 聊天正在进行，进入等待状态
			this.taskboardStatus = "waiting_for_chat";
			await this.#waitForChatCompletion();

			// 聊天完成后，检查状态是否仍然是 waiting_for_chat
			// （用户可能在等待期间取消了）
			if (this.taskboardStatus === "waiting_for_chat") {
				this.taskboardStatus = "running";
				await this.#executeLoop(fn);
			}
			return;
		}

		// 聊天未进行，直接开始执行
		this.taskboardStatus = "running";
		await this.#executeLoop(fn);
	}

	/**
	 * Executes the task loop.
	 */
	async #executeLoop(fn: (content: string) => Promise<boolean>): Promise<void> {
		while (this.taskboardStatus === "running") {
			const nextTask = this.tasklist.find(
				(t) => t.status === "in_progress" || t.status === "pending",
			);

			if (!nextTask) {
				this.taskboardStatus = "idle";

				// Emit event when all tasks are completed
				emitter.emit(EventNames.TASKBOARD_ALL_TASKS_DONE, {
					sandboxId: codeAgentState.sandboxId,
					sessionId: codeAgentState.currentSessionId,
					taskCount: this.tasklist.filter((t) => t.status === "done").length,
				});

				break;
			}

			await this.#executeTask(nextTask, fn);

			// Check if we need to pause (status may have been modified externally during await)
			if (this.taskboardStatus !== "running") {
				if (this.taskboardStatus === "waiting_to_stop") {
					this.taskboardStatus = "idle";
				}
				break;
			}
		}
	}

	/**
	 * Executes a single task.
	 */
	async #executeTask(task: Task, fn: (content: string) => Promise<boolean>): Promise<void> {
		this.currentExecutingTaskId = task.id;
		this.#currentRetryCount = 0;
		this.retryExhausted = false;

		const total = Math.min(99, Math.max(1, task.number ?? 1));
		const executed = Math.max(0, task.executedCount ?? 0);
		const remaining = total - executed;
		if (remaining <= 0) {
			await this.#updateTaskStatus(task.id, { status: "done" });
			return;
		}

		if (task.status === "pending") {
			const updatedList = this.tasklist.map((t) =>
				t.id === task.id
					? {
							...t,
							status: "in_progress" as const,
							executedCount: Math.min(total, (t.executedCount ?? 0) + 1),
						}
					: t,
			);
			await this.updateTasklist(updatedList);
		}

		const offChatFinished = emitter.on(EventNames.CHAT_FINISHED, this.#handleChatFinished);

		try {
			while (this.#currentRetryCount < this.#MAX_RETRY_COUNT) {
				const message =
					this.#currentRetryCount === 0
						? task.content
						: `${m.text_continue()}: ${task.content}`;

				const waitPromise = this.#waitForChatFinished();
				const didSend = await fn(message);
				if (!didSend) {
					this.taskboardStatus = "idle";
					this.isAutoPaused = true;
					await this.#updateTaskStatus(task.id, {
						status: "pending",
						executedCount: executed,
					});
					return;
				}

				const success = await waitPromise;

				if (success) {
					const [sandboxId, path] = [
						codeAgentState.sandboxId,
						codeAgentState.currentWorkspacePath,
					];

					let currentTaskList = this.tasklist;
					const { isOk, tasks } = await _getTasklist(sandboxId, path);
					if (isOk) {
						currentTaskList = this.#sortTasks(tasks);
						this.tasklist = currentTaskList;

						logger.info("Tasklist updated", currentTaskList);
					}

					const updatedTask = currentTaskList.find((t) => t.id === task.id);
					const nextTotal = Math.min(99, Math.max(1, updatedTask?.number ?? total));
					const nextExecuted = Math.max(updatedTask?.executedCount ?? 0, executed + 1);
					const nextRemaining = nextTotal - nextExecuted;
					await this.#updateTaskStatus(task.id, {
						status: nextRemaining > 0 ? "pending" : "done",
						executedCount: nextExecuted,
					});
					return;
				}

				if (this.taskboardStatus !== "running") {
					break;
				}

				this.#currentRetryCount++;
				logger.info(
					`[TaskBoard] Task retry ${this.#currentRetryCount}/${this.#MAX_RETRY_COUNT}`,
				);
			}
			logger.info(
				`[TaskBoard] Task retry ${this.#currentRetryCount}/${this.#MAX_RETRY_COUNT}`,
			);

			if (this.#currentRetryCount >= this.#MAX_RETRY_COUNT) {
				this.retryExhausted = true;
				this.isAutoPaused = true;
			}

			this.taskboardStatus = "idle";
			const updatedList = this.tasklist.map((t) => {
				if (t.id !== task.id) return t;
				return {
					...t,
					status: "pending" as const,
					executedCount: Math.max(0, (t.executedCount ?? 0) - 1),
				};
			});
			await this.updateTasklist(updatedList);
		} finally {
			offChatFinished();
			this.currentExecutingTaskId = null;
			this.#taskResolve = null;
		}
	}

	#waitForChatFinished(): Promise<boolean> {
		return new Promise<boolean>((resolve) => {
			this.#taskResolve = resolve;
		});
	}

	/**
	 * Waits for the current chat to complete.
	 * Resolves when chat status becomes "ready" or when user cancels the chat.
	 */
	async #waitForChatCompletion(): Promise<void> {
		return new Promise<void>((resolve) => {
			// 如果聊天已经完成，立��返回
			if (!chatState.isStreaming && !chatState.isSubmitted) {
				resolve();
				return;
			}

			// 使用 $effect 监听状态变化
			const cleanup = $effect.root(() => {
				$effect(() => {
					// 监听 chat.status 变化
					const status = chat.status;
					if (status === "ready" || status === "error") {
						cleanup();
						resolve();
					}
				});
			});
		});
	}

	/**
	 * Handles the chat finished event.
	 */
	#handleChatFinished = ({ lastMessage }: { lastMessage: ChatMessage }) => {
		logger.info("CHAT_FINISHED event received", {
			hasTaskResolve: !!this.#taskResolve,
			taskboardStatus: this.taskboardStatus,
		});

		if (!this.#taskResolve) return;

		// 🔧 open-claw 模式下直接认为成功，claude-code 模式检查 metadata.result
		let success: boolean;
		if (codeAgentState.currentAgentId === "open-claw") {
			logger.info("Open-claw mode: treating chat completion as task success");
			success = true;
		} else {
			const result = lastMessage.metadata?.result;
			success = !!result && result.is_error === false;
		}

		logger.info("Resolving task with success:", success);
		this.#taskResolve(success);
	};

	/**
	 * Sorts tasks by status: in_progress -> pending -> done
	 */
	#sortTasks(tasks: Task[]): Task[] {
		return [...tasks].sort((a, b) => {
			const statusOrder = { in_progress: 0, pending: 1, done: 2 };
			const orderA = statusOrder[a.status] ?? 1;
			const orderB = statusOrder[b.status] ?? 1;
			return orderA - orderB;
		});
	}

	/**
	 * 当等待聊天期间任务已被清空时，回收过期状态，避免状态栏卡在等待中。
	 */
	#reconcileWaitingForChatStatus(tasklist: Task[]): void {
		if (this.taskboardStatus !== "waiting_for_chat") return;

		const hasExecutableTasks = tasklist.some(
			(task) => task.status === "pending" || task.status === "in_progress",
		);
		if (!hasExecutableTasks) {
			this.taskboardStatus = "idle";
		}
	}

	/**
	 * Updates the status and other properties of a single task.
	 */
	async #updateTaskStatus(taskId: string, updates: Partial<Task>): Promise<void> {
		const updatedList = this.tasklist.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
		await this.updateTasklist(updatedList);
	}
}

export const codeAgentTaskboardState = new CodeAgentTaskboardState();

$effect.root(() => {
	$effect(() => {
		// Track enabled state

		// codeAgentState.sessionId;
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		codeAgentState.enabled;

		codeAgentTaskboardState.tasklist = [];
		codeAgentTaskboardState.isAutoPaused = false;
	});
});

$effect.root(() => {
	$effect(() => {
		// Re-evaluate auto execution when core state changes
		/* eslint-disable @typescript-eslint/no-unused-expressions */
		codeAgentTaskboardState.tasklist;
		codeAgentTaskboardState.taskboardStatus;
		codeAgentTaskboardState.isAutoPaused;
		codeAgentTaskboardState.retryExhausted;
		codeAgentState.inPlanMode;
		/* eslint-enable @typescript-eslint/no-unused-expressions */

		void codeAgentTaskboardState.autoStartIfPossible();
	});
});
