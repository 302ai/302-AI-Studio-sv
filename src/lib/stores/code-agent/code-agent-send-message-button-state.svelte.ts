import { batchUploadFile, initProject } from "$lib/api/taskboard/base-apis";
import { m } from "$lib/paraglide/messages";
import { nanoid } from "nanoid";
import { toast } from "svelte-sonner";
import { chatState } from "../chat-state.svelte";
import { mcpState } from "../mcp-state.svelte";
import { codeAgentState } from "./code-agent-state.svelte";
import { codeAgentTaskboardState } from "./code-agent-taskboard-state.svelte";
import { localClaudeCodeSandboxState } from "./local-claude-code-sandbox-state.svelte";
import { localEnvState } from "./local-env-state.svelte";
import { fileToBase64 } from "./utils";

const { addClaudeCodeSandboxMCP } = window.electronAPI.codeAgentService;

class CodeAgentSendMessageButtonState {
	executionIterator: AsyncGenerator<string, void, boolean> | null = null;

	showLackOfDiskDialog = $state(false);
	isChecking = $state(false);

	/**
	 * Ensures the local sandbox is ready for use in local mode
	 * - If not in local mode, returns success immediately
	 * - If in local mode, checks and starts the sandbox if needed
	 * - Shows toast notifications for starting/started states
	 * - Uses localEnvState.sandboxStarting for shared loading state
	 * - Updates codeAgentState.localBaseUrl on success
	 */
	async ensureLocalSandboxReady(): Promise<{ isOk: boolean; error?: string }> {
		if (codeAgentState.type !== "local") {
			return { isOk: true };
		}

		const startedChecking = !this.isChecking;
		if (startedChecking) {
			this.isChecking = true;
		}

		try {
			const result = await localEnvState.ensureSandboxRunning();

			if (!result.isOk) {
				return { isOk: false, error: result.error };
			}

			// Update localBaseUrl with the port
			if (result.port) {
				codeAgentState.localBaseUrl = `http://localhost:${result.port}/api/v1`;
			}

			// Show success toast only when actually started (not already running)
			if (!result.wasAlreadyRunning) {
				toast.success(m.code_agent_local_sandbox_started());
				console.log("[CodeAgent] Local sandbox started successfully on port:", result.port);
			}

			return { isOk: true };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			console.error("[CodeAgent] Failed to ensure local sandbox ready:", errorMessage);
			return { isOk: false, error: errorMessage };
		} finally {
			if (startedChecking) {
				this.isChecking = false;
			}
		}
	}

	async #attachmentToBase64(attachment: {
		file?: unknown;
		preview?: unknown;
		filePath?: unknown;
		name?: string;
	}): Promise<string | null> {
		if (attachment.file instanceof Blob) {
			return await fileToBase64(attachment.file as File);
		}

		if (typeof attachment.filePath === "string") {
			// Check if filePath is an absolute path (contains path separators)
			// If it's just a filename without path, it cannot be read via Electron
			const isAbsolutePath =
				attachment.filePath.includes("/") ||
				attachment.filePath.includes("\\") ||
				/^[a-zA-Z]:/.test(attachment.filePath);

			if (isAbsolutePath) {
				try {
					const buffer = await window.electronAPI.appService.readFileAsBuffer(attachment.filePath);
					let binary = "";
					const bytes = new Uint8Array(buffer);
					for (let i = 0; i < bytes.byteLength; i++) {
						binary += String.fromCharCode(bytes[i]);
					}

					// Determine MIME type based on file extension
					let mimeType = "application/octet-stream";
					if (attachment.name) {
						const ext = attachment.name.split(".").pop()?.toLowerCase();
						switch (ext) {
							case "png":
								mimeType = "image/png";
								break;
							case "jpg":
							case "jpeg":
								mimeType = "image/jpeg";
								break;
							case "gif":
								mimeType = "image/gif";
								break;
							case "webp":
								mimeType = "image/webp";
								break;
							case "svg":
								mimeType = "image/svg+xml";
								break;
							case "json":
								mimeType = "application/json";
								break;
							case "txt":
								mimeType = "text/plain";
								break;
							case "pdf":
								mimeType = "application/pdf";
								break;
						}
					}

					return `data:${mimeType};base64,${window.btoa(binary)}`;
				} catch (error) {
					console.error("Failed to read file from path:", attachment.filePath, error);
					// Fallback to preview if file read fails
				}
			}
		}

		// Prioritize using preview if it's a data URL (covers both image previews and our manual full-content reads)
		if (typeof attachment.preview === "string" && attachment.preview.startsWith("data:")) {
			return attachment.preview;
		}

		// Return null if no valid content source available
		return null;
	}

	async *enableCodeAgentFlow(fn: () => void) {
		this.isChecking = true;

		try {
			// Ensure local sandbox is running if in local mode
			const localSandboxResult = await this.ensureLocalSandboxReady();
			if (!localSandboxResult.isOk) {
				toast.error(m.code_agent_local_sandbox_start_failed());
				return;
			}

			if (chatState.selectedModel && codeAgentState.currentModel !== chatState.selectedModel.id) {
				codeAgentState.updateSandboxModel(chatState.selectedModel.id);
			}

			const { isOK, sandboxInfo } = await codeAgentState.executeCodeAgentMode();
			if (!isOK) {
				return;
			}

			if (sandboxInfo) {
				let workspacePath: string | undefined;

				if (codeAgentTaskboardState.isInitialized) {
					const isSessionIdEmpty = codeAgentState.sessionId === "";
					const sessionId: string = isSessionIdEmpty ? nanoid() : codeAgentState.sessionId;
					const shouldSkipInitProject = codeAgentState.type === "local" && !isSessionIdEmpty;

					if (shouldSkipInitProject) {
						workspacePath = codeAgentState.currentWorkspacePath;

						if (!workspacePath) {
							workspacePath = localClaudeCodeSandboxState.sessions.find(
								(session) => session.session_id === sessionId,
							)?.workspace_path;
						}

						if (!workspacePath) {
							await localClaudeCodeSandboxState.refreshSessions();
							workspacePath = localClaudeCodeSandboxState.sessions.find(
								(session) => session.session_id === sessionId,
							)?.workspace_path;
						}
					} else {
						const { workspace_path } = await initProject({
							sandboxId: sandboxInfo.sandboxId,
							sessionId,
							workspacePath: codeAgentState.currentWorkspacePath,
						});

						workspacePath = workspace_path;

						// Update currentWorkspacePath with the actual path from server
						if (workspace_path) {
							codeAgentState.updateCurrentWorkspacePath(workspace_path);
						}

						// Refresh sessions to sync the new workspace_path to local storage
						if (codeAgentState.type === "local") {
							await localClaudeCodeSandboxState.refreshSessions();
						} else {
							await window.electronAPI.codeAgentService.updateClaudeCodeSessions(
								sandboxInfo.sandboxId,
							);
						}
					}

					if (!workspacePath) {
						console.error("[CodeAgent] Missing workspace path for taskboard:", {
							type: codeAgentState.type,
							sessionId,
							currentWorkspacePath: codeAgentState.currentWorkspacePath,
						});
						toast.error(m.taskboard_error_sandbox_not_initialized());
						return;
					}

					// Collect all files to upload in a single batch request
					const filesToUpload: Array<{ content: string; save_path: string }> = [];

					// 1. tasks.json
					const tasksFilePath = `${workspacePath}/.302ai/todo/tasks.json`;
					const jsonContent = JSON.stringify(codeAgentTaskboardState.tasklist);
					const base64Content =
						"data:application/json;base64," +
						window.btoa(
							encodeURIComponent(jsonContent).replace(/%([0-9A-F]{2})/g, (_, p1) =>
								String.fromCharCode(parseInt(p1, 16)),
							),
						);
					filesToUpload.push({ content: base64Content, save_path: tasksFilePath });

					// 2. taskboard attachments
					if (codeAgentTaskboardState.attachments.length > 0) {
						const taskboardAttachmentResults = await Promise.all(
							codeAgentTaskboardState.attachments.map(async (att) => {
								const content = att.file ? await fileToBase64(att.file) : null;
								return content
									? { content, save_path: `${workspacePath}/.302ai/attachments/${att.name}` }
									: null;
							}),
						);
						const validTaskboardAttachments = taskboardAttachmentResults.filter(
							(item): item is { content: string; save_path: string } => item !== null,
						);
						filesToUpload.push(...validTaskboardAttachments);
					}

					// 3. pending attachments
					if (codeAgentTaskboardState.pendingAttachments.length > 0) {
						console.log(
							"pending attachments count:",
							codeAgentTaskboardState.pendingAttachments.length,
						);
						const pendingAttachmentResults = await Promise.all(
							codeAgentTaskboardState.pendingAttachments.map(async (att) => {
								const content = att.file ? await fileToBase64(att.file) : null;
								if (!content) console.warn("Pending attachment content is null for:", att.name);
								return content
									? { content, save_path: `${workspacePath}/.302ai/attachments/${att.name}` }
									: null;
							}),
						);
						const validPendingAttachments = pendingAttachmentResults.filter(
							(item): item is { content: string; save_path: string } => item !== null,
						);
						console.log("valid pending attachments:", validPendingAttachments.length);
						filesToUpload.push(...validPendingAttachments);
						codeAgentTaskboardState.clearPendingAttachments();
					}

					if (chatState.attachments.length > 0) {
						console.log("chat attachments count:", chatState.attachments.length);
						const chatAttachmentResults = await Promise.all(
							chatState.attachments.map(async (att) => {
								const content = await this.#attachmentToBase64(att);
								if (!content)
									console.warn("Chat attachment content is null for:", att.name, att.filePath);
								return content
									? { content, save_path: `${workspacePath}/.302ai/attachments/${att.name}` }
									: null;
							}),
						);
						// Filter out null results (attachments that couldn't be converted)
						const validChatAttachments = chatAttachmentResults.filter(
							(item): item is { content: string; save_path: string } => item !== null,
						);
						console.log("valid chat attachments:", validChatAttachments.length);
						filesToUpload.push(...validChatAttachments);
					}

					// Upload all files in a single batch request
					if (filesToUpload.length > 0) {
						console.log("Total files to upload:", filesToUpload.length);
						const response = await batchUploadFile({
							sandbox_id: sandboxInfo.sandboxId,
							file_list: filesToUpload,
						});

						const faileds = response.result.filter((r) => !r.success);
						if (!response.success || faileds.length > 0) {
							console.error("Failed to upload files:", faileds.map((r) => r.error).join(", "));
							toast.error(m.taskboard_error_attachment_upload_failed());
							return;
						}
					}

					if (isSessionIdEmpty) {
						codeAgentState.updateCurrentSessionId(sessionId);
					}
				}

				if (chatState.selectedModel && chatState.selectedModel.id !== sandboxInfo.llmModel) {
					await codeAgentState.handleCodeAgentModelChange(chatState.selectedModel);
				}

				// 在 sandbox 确认后，添加用户选择的 MCP 服务器
				if (chatState.mcpServerIds.length > 0) {
					const infos = mcpState.getMCPInfosByIds(chatState.mcpServerIds);
					if (infos.length > 0) {
						try {
							await addClaudeCodeSandboxMCP(sandboxInfo.sandboxId, infos, codeAgentState.type);
						} catch (error) {
							console.error("Failed to add MCP servers:", error);
						}
					}
				}

				if (sandboxInfo.diskUsage === "insufficient") {
					this.showLackOfDiskDialog = true;
					const shouldContinue: boolean = yield "wait_user_choice";
					if (!shouldContinue) {
						codeAgentState.isCodeAgentPanelOpen = true;
						return;
					}
				}
			}

			fn();
		} catch (error) {
			console.error("Failed to enable code agent flow:", error);
		} finally {
			this.isChecking = false;
		}
	}

	async handleContinueAnyway() {
		this.showLackOfDiskDialog = false;
		if (this.executionIterator) {
			await this.executionIterator.next(true);
			this.executionIterator = null;
		}
	}

	async handleChangeSandbox() {
		this.showLackOfDiskDialog = false;
		if (this.executionIterator) {
			await this.executionIterator.next(false);
			this.executionIterator = null;
		}
	}

	async handleCodeAgentFlow(fn: () => void) {
		this.executionIterator = this.enableCodeAgentFlow(fn);
		await this.executionIterator.next();
	}
}

export const codeAgentSendMessageButtonState = new CodeAgentSendMessageButtonState();
