/**
 * Utility functions for agent-preview module
 */

import type { SandboxFileInfo } from "$lib/api/sandbox-file";
import { createLogger } from "@shared/logger";

const logger = createLogger("ui");
import { toast } from "svelte-sonner";

/**
 * Get threadId from window.tab or default to "shell"
 */
export function getThreadId(): string {
	const tab = window.tab;
	if (tab && typeof tab === "object" && "threadId" in tab && typeof tab.threadId === "string") {
		return tab.threadId;
	}
	return "shell";
}

/**
 * Validate sandbox ID format
 * @param id - Sandbox ID to validate
 * @returns true if valid, false otherwise
 */
export function validateSandboxId(id: string): boolean {
	return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Validate file path format
 * @param path - File path to validate
 * @returns true if valid, false otherwise
 */
export function validatePath(path: string): boolean {
	return path.startsWith("/") && !path.includes("..");
}

/**
 * Standardized error handler
 * @param error - Error to handle
 * @param context - Context where error occurred
 * @param showToast - Whether to show toast notification (default: true)
 */
export function handleError(error: unknown, context: string, showToast = true): void {
	const message = error instanceof Error ? error.message : String(error);
	logger.error(`[AgentPreview] ${context}:`, error);
	if (showToast) {
		toast.error(message);
	}
}

/**
 * Type guard to check if file is still selected
 * @param filePath - File path to check
 * @param currentFile - Current selected file
 * @returns true if file is still selected
 */
export function isFileStillSelected(
	filePath: string,
	currentFile: SandboxFileInfo | null,
): boolean {
	return currentFile?.path === filePath;
}
