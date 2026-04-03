import { createLogger } from "@shared/logger";
import { taskListSchema, type Task } from "@shared/types";
import { type } from "arktype";
import { batchUploadFile, downloadFilesFromSandbox, executeCommand } from "./base-apis";

const logger = createLogger("ui");

const TODO_TASKS_FILE_PATH = ".302ai/todo/tasks.json";
const ATTACHMENTS_DIR_PATH = ".302ai/attachments";

/**
 * Validate and repair the task list.
 * If the content is invalid (not JSON or not matching schema), it will be overwritten with an empty array.
 * @param sandboxId - The sandbox ID
 * @param cwd - The project root directory
 * @param content - The raw JSON string content
 * @returns The validated task list or an empty array if repair was needed
 */
async function validateAndRepairTaskList(
	sandboxId: string,
	cwd: string,
	content: string,
): Promise<Task[]> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let parsed: any;
	try {
		parsed = JSON.parse(content);
	} catch (error) {
		logger.warn("Task list JSON parse failed, returning empty list:", error);
		logger.error("Task list content:", content);
		return [];
	}

	// Repair fields: normalize number/executedCount, and reset in_progress tasks.
	for (const task of parsed) {
		const hadNewFields = task && ("executedCount" in task || typeof task?.number === "number");

		// number (repeat count / total repeats): ensure finite integer in [1, 99]
		const rawNumber = task?.number;
		const n =
			typeof rawNumber === "number" ? rawNumber : Number.parseInt(String(rawNumber), 10);
		if (!Number.isFinite(n)) {
			task.number = 1;
		} else {
			task.number = Math.min(99, Math.max(1, Math.trunc(n)));
		}

		// executedCount: default missing/invalid to 0 (old data can't be reliably inferred)
		const rawExecuted = task?.executedCount;
		const executed =
			typeof rawExecuted === "number"
				? rawExecuted
				: Number.parseInt(String(rawExecuted), 10);
		if (!Number.isFinite(executed)) {
			task.executedCount = 0;
		} else {
			task.executedCount = Math.trunc(executed);
		}

		// Special case: legacy done tasks without new fields -> set both fields to 1
		if (task?.status === "done" && !hadNewFields) {
			task.number = 1;
			task.executedCount = 1;
		}

		// Clamp executedCount into [0, number]
		task.executedCount = Math.min(task.number, Math.max(0, task.executedCount));
	}

	const validated = taskListSchema(parsed);

	if (validated instanceof type.errors) {
		logger.warn("Task list schema validation failed, returning empty list:", validated.summary);
		return [];
	}

	// Remove duplicate tasks by id (keep first occurrence)
	const seenIds = new Set<string>();
	const uniqueTasks = validated.filter((task) => {
		if (seenIds.has(task.id)) {
			return false;
		}
		seenIds.add(task.id);
		return true;
	});

	// If duplicates were found, update the file
	if (uniqueTasks.length !== validated.length) {
		logger.warn(
			`Found ${validated.length - uniqueTasks.length} duplicate task(s), removing duplicates`,
		);
		await updateTasklist(sandboxId, cwd, uniqueTasks);
	}

	return uniqueTasks;
}

/**
 * Get the task list from the sandbox
 * @param sandboxId - The sandbox ID
 * @param cwd - The project root directory
 * @returns The task list
 */
export async function getTasklist(
	sandboxId: string,
	cwd: string,
): Promise<{ isOk: boolean; tasks: Task[] }> {
	try {
		const tasksFilePath = `${cwd}/${TODO_TASKS_FILE_PATH}`;
		const dir = tasksFilePath.substring(0, tasksFilePath.lastIndexOf("/"));
		const response = await executeCommand({
			sandboxId,
			cwd,
			command: `mkdir -p ${dir} && if [ ! -f ${tasksFilePath} ]; then echo '[]' > ${tasksFilePath}; fi && cat ${tasksFilePath}`,
		});

		if (!response.success || response.result.exit_code !== 0) {
			// If file doesn't exist or other error, return empty list for now
			return { isOk: false, tasks: [] };
		}

		const tasks = await validateAndRepairTaskList(sandboxId, cwd, response.result.stdout);
		return { isOk: true, tasks };
	} catch (error) {
		logger.error("Failed to get task list:", error);
		return { isOk: false, tasks: [] };
	}
}

/**
 * Get the task list from the sandbox
 * @param sandboxId - The sandbox ID
 * @param cwd - The project root directory
 * @returns The task list
 */
export async function _getTasklist(
	sandboxId: string,
	cwd: string,
): Promise<{ isOk: boolean; tasks: Task[] }> {
	try {
		const tasksFilePath = `${cwd}/${TODO_TASKS_FILE_PATH}`;
		const response = await downloadFilesFromSandbox({
			sandboxId,
			path: tasksFilePath,
			format: "text",
		});

		const tasks = await validateAndRepairTaskList(sandboxId, cwd, response.content);
		return { isOk: true, tasks };
	} catch (error) {
		logger.error("Failed to get task list:", error);
		return { isOk: false, tasks: [] };
	}
}

/**
 * Update the task list in the sandbox
 * @param sandboxId - The sandbox ID
 * @param cwd - The project root directory
 * @param tasks - The task list to update
 */
export async function updateTasklist(
	sandboxId: string,
	cwd: string,
	tasks: Task[],
): Promise<{ isOk: boolean }> {
	try {
		const tasksFilePath = `${cwd}/${TODO_TASKS_FILE_PATH}`;

		let jsonContent: string;
		try {
			jsonContent = JSON.stringify(tasks);
		} catch (error) {
			logger.error("Failed to stringify tasks:", error);
			logger.error("Tasks content:", tasks);
			return { isOk: false };
		}
		logger.info("Updating task list content:", jsonContent);
		const base64Content =
			"data:application/json;base64," +
			window.btoa(
				encodeURIComponent(jsonContent).replace(/%([0-9A-F]{2})/g, (_, p1) =>
					String.fromCharCode(parseInt(p1, 16)),
				),
			);

		const response = await batchUploadFile({
			sandbox_id: sandboxId,
			file_list: [
				{
					content: base64Content,
					save_path: tasksFilePath,
				},
			],
			ts: Date.now(),
		});

		if (!response.success || !response.result?.[0]?.success) {
			logger.error("Failed to update task list:", response.result?.[0]?.error);
			return { isOk: false };
		}
		return { isOk: true };
	} catch (error) {
		logger.error("Failed to update task list:", error);
		return { isOk: false };
	}
}

export interface Attachment {
	filename: string;
	content: string;
}

/**
 * Upload attachments to the sandbox
 * @param sandboxId - The sandbox ID
 * @param cwd - The project root directory
 * @param attachments - The attachments to upload
 * @returns Whether the upload was successful
 */
export async function uploadAttachments(
	sandboxId: string,
	cwd: string,
	attachments: Attachment[],
): Promise<{ isOk: boolean }> {
	if (attachments.length === 0) {
		return { isOk: true };
	}

	try {
		const fileList = attachments.map((attachment) => ({
			content: attachment.content,
			save_path: `${cwd}/${ATTACHMENTS_DIR_PATH}/${attachment.filename}`,
		}));

		const response = await batchUploadFile({
			sandbox_id: sandboxId,
			file_list: fileList,
		});

		const faileds = response.result.filter((r) => !r.success);
		if (!response.success || faileds.length > 0) {
			logger.error("Failed to upload attachments:", faileds.map((r) => r.error).join(", "));
			return { isOk: false };
		}

		return { isOk: true };
	} catch (error) {
		logger.error("Failed to upload attachments:", error);
		return { isOk: false };
	}
}
