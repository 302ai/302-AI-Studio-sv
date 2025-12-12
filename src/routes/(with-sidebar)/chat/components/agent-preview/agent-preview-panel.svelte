<script lang="ts">
	import { getFileContent, uploadSandboxFile, type SandboxFileInfo } from "$lib/api/sandbox-file";
	import { deployHtmlTo302, validate302Provider } from "$lib/api/webserve-deploy";
	import UnDeployedIcon from "$lib/assets/icons/code-agent/unDeployed.svg";
	import CodeMirrorEditor from "$lib/components/buss/editor/codemirror-editor.svelte";
	import PreviewHeader, { type PreviewTab } from "$lib/components/chat/preview-header.svelte";
	import PreviewPanel from "$lib/components/html-preview/preview-panel.svelte";

	import Button from "$lib/components/ui/button/button.svelte";
	import * as m from "$lib/paraglide/messages";
	import {
		agentPreviewState,
		type AgentPreviewSyncEnvelope,
	} from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { claudeCodeSandboxState } from "$lib/stores/code-agent/claude-code-sandbox-state.svelte";
	import { claudeCodeAgentState } from "$lib/stores/code-agent/claude-code-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";

	import { htmlPreviewState } from "$lib/stores/html-preview-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { Loader2, Pencil, Save, X } from "@lucide/svelte";
	import type { ModelProvider } from "@shared/types";
	import { onDestroy, untrack } from "svelte";
	import { toast } from "svelte-sonner";
	import {
		DEVICE_MODE_DESKTOP,
		DEVICE_MODE_MOBILE,
		TAB_CODE,
		TAB_PREVIEW,
		TAB_TERMINAL,
		type DeviceMode,
		type TabType,
	} from "./constants";
	import FileTree from "./file-tree.svelte";
	import SessionDeleted from "./session-deleted.svelte";
	import Terminal from "./terminal.svelte";
	import { handleError, isFileStillSelected, withRetry } from "./utils";

	// --- Utils (Move strictly pure functions outside) ---
	const LANGUAGE_MAP: Record<string, string> = {
		js: "javascript",
		jsx: "javascript",
		ts: "typescript",
		tsx: "typescript",
		py: "python",
		md: "markdown",
		json: "json",
		html: "html",
		css: "css",
		xml: "xml",
		svg: "svg",
		sh: "shell",
		bash: "shell",
		txt: "text",
	};

	function detectLanguage(filename: string): string {
		const ext = filename.split(".").pop()?.toLowerCase();
		return LANGUAGE_MAP[ext || ""] || "text";
	}

	// --- State ---
	let activeTab = $state<TabType>(TAB_PREVIEW);
	let deviceMode = $state<DeviceMode>(DEVICE_MODE_DESKTOP);

	// Grouped Deployment State
	let deployment = $state({
		isDeploying: false,
		url: null as string | null,
		deploymentId: null as string | null,
	});

	// Grouped File Viewer State
	let fileViewer = $state({
		selectedFile: null as SandboxFileInfo | null,
		content: "",
		isLoading: false,
		language: "text",
	});
	let syncUnsubscribe: (() => void) | null = null;

	let refreshTrigger = $state(0);
	let iframeRefreshKey = $state(0);

	// Edit State
	let isEditing = $state(false);
	let isSaving = $state(false);
	let editContent = $state("");

	// Internal logic variables (non-reactive)
	let abortController: AbortController | null = null;
	let isRestoringState = $state(false); // Track loading state for UI
	let previousStreamingState = false; // 用于追踪流式状态边缘

	// --- Derived ---
	const isAgentMode = $derived(codeAgentState.enabled);
	const currentSandboxId = $derived(claudeCodeAgentState.sandboxId);
	const currentSessionId = $derived.by(() => {
		// If currentSessionId matches one of the known valid sessionIds, use it
		if (
			claudeCodeAgentState.currentSessionId
			// &&
			// claudeCodeAgentState.sessionIds.some(
			// 	(s) => getId(s) === claudeCodeAgentState.currentSessionId,
			// )
		) {
			return claudeCodeAgentState.currentSessionId;
		}
		// Otherwise fallback to the first available session ID (assuming single active session in most cases)
		// const firstValidSession = claudeCodeAgentState.sessionIds.find((s) => getId(s));
		// if (firstValidSession) {
		// 	return getId(firstValidSession);
		// }
		return "";
	});

	// Tabs definition
	let tabs: PreviewTab[] = $derived.by(() => {
		const t = [
			{ id: "preview", label: m.label_tab_preview() },
			{ id: "code", label: m.label_tab_file() },
		];
		if (isAgentMode) {
			t.push({ id: TAB_TERMINAL, label: m.label_tab_terminal() });
		}
		return t;
	});

	// --- Effects & Logic ---

	// 1. State Restoration Logic
	// Track the last restored session to prevent duplicate restores
	let lastRestoredKey = "";

	function setupContentSync(sandboxId: string, sessionId: string) {
		if (syncUnsubscribe) {
			syncUnsubscribe();
		}

		syncUnsubscribe = agentPreviewState.onSync((message: AgentPreviewSyncEnvelope) => {
			if (message.sandboxId !== sandboxId || message.sessionId !== sessionId) {
				return;
			}

			// Handle deployment update from any source (including self)
			// This is needed when onFinish saves deployment info and we need to refresh the UI
			if (
				message.type === "fileListUpdated" &&
				message.sourceInstanceId === agentPreviewState.syncIdentifier
			) {
				// Force re-check deployment info by clearing the restored key
				lastRestoredKey = "";
				// Trigger a state restore to pick up the new deployment info
				untrack(() => {
					restoreState(sandboxId, sessionId);
				});
			}

			// For other message types, only handle from other instances
			if (message.sourceInstanceId === agentPreviewState.syncIdentifier) {
				return;
			}

			if (
				message.type === "fileContentUpdated" &&
				fileViewer.selectedFile?.path === message.filePath &&
				!isEditing
			) {
				fileViewer.content = message.content;
				fileViewer.selectedFile = {
					...fileViewer.selectedFile,
					modified_time: message.modifiedTime ?? fileViewer.selectedFile.modified_time,
				};
			}
		});
	}

	const restoreState = async (sandboxId: string, sessionId: string) => {
		const key = `${sandboxId}:${sessionId}`;

		// Skip if already restored this session or currently restoring
		if (lastRestoredKey === key || isRestoringState) {
			return;
		}

		if (!sandboxId || !sessionId) {
			return;
		}

		isRestoringState = true;

		try {
			// Then refresh sessions to get workspace_path for the current session
			// This ensures the file tree has the correct workspace path before loading
			// await claudeCodeSandboxState.refreshSessions(sandboxId);

			const [info, savedPath] = await Promise.all([
				agentPreviewState.getDeploymentInfo(sandboxId, sessionId),
				agentPreviewState.getSelectedFilePath(sandboxId, sessionId),
			]);

			deployment.url = info?.url ?? null;
			deployment.deploymentId = info?.deploymentId ?? null;

			if (savedPath) {
				const storage = await agentPreviewState.loadFromStorage(sandboxId, sessionId);
				const file = storage?.fileList?.find((f) => f.path === savedPath);
				if (file) await handleFileSelect(file);
			}

			// Mark as restored only after successful completion
			lastRestoredKey = key;
		} catch (e) {
			console.warn("[AgentPreview] State restore failed (ignored):", e);
		} finally {
			isRestoringState = false;
		}
	};

	$effect(() => {
		// Track sandboxId and sessionId to detect changes
		const sandboxId = currentSandboxId;
		const sessionId = currentSessionId;
		const isVisible = agentPreviewState.isVisible;
		const agentMode = isAgentMode;

		// Only restore state when panel is visible and all conditions are met
		if (isVisible && agentMode && sandboxId && sessionId) {
			// Use untrack to prevent restoreState's internal state changes from triggering re-runs
			untrack(() => {
				restoreState(sandboxId, sessionId);
			});
		}
	});

	$effect(() => {
		const sandboxId = currentSandboxId;
		const sessionId = currentSessionId;

		if (sandboxId && sessionId) {
			setupContentSync(sandboxId, sessionId);
		} else if (syncUnsubscribe) {
			syncUnsubscribe();
			syncUnsubscribe = null;
		}
	});

	// 2. File Tree Refresh Trigger (Detecting stream end)
	$effect(() => {
		const isStreaming = chatState.isStreaming;
		// 类似于 React 的 usePrevious + useEffect 组合
		if (previousStreamingState && !isStreaming) {
			if (isAgentMode && agentPreviewState.isVisible && currentSandboxId) {
				console.log("[AgentPreview] Task completed, triggering refresh");
				refreshTrigger++;

				// Refresh sessions to get updated workspace_path after agent completes
				// This is important because session/workspace is created after agent's first response
				claudeCodeSandboxState.refreshSessions(currentSandboxId);
			}
		}
		previousStreamingState = isStreaming;
	});

	// Cleanup on unmount
	onDestroy(() => {
		abortController?.abort();
		if (syncUnsubscribe) {
			syncUnsubscribe();
			syncUnsubscribe = null;
		}
	});

	// --- Handlers ---

	const get302ApiKey = () => {
		const provider = persistedProviderState.current.find((p) => p.name === "302.AI" && p.enabled);
		return provider?.apiKey || "";
	};

	async function handleFileSelect(file: SandboxFileInfo) {
		abortController?.abort();
		abortController = new AbortController();
		const signal = abortController.signal;

		// 立即更新 UI 状态
		fileViewer.selectedFile = file;
		fileViewer.isLoading = true;
		fileViewer.language = detectLanguage(file.name);
		const currentFilePath = file.path;

		try {
			if (!currentSandboxId || !currentSessionId) throw new Error("No sandbox/session");

			// 1. Try Cache
			const cachedContent = await agentPreviewState.getFileContent(
				currentSandboxId,
				currentSessionId,
				file.path,
				file.modified_time,
			);

			if (signal.aborted) return;

			if (cachedContent && isFileStillSelected(currentFilePath, fileViewer.selectedFile)) {
				await agentPreviewState.setSelectedFilePath(currentSandboxId, currentSessionId, file.path);
				fileViewer.content = cachedContent;
				fileViewer.isLoading = false;
				return;
			}

			// 2. Fetch from API
			const apiKey = get302ApiKey();
			if (!apiKey) throw new Error("302.AI API key not found");

			const content = await withRetry(
				() => getFileContent(currentSandboxId!, file.path, apiKey, undefined, signal),
				3,
				1000,
			);

			if (signal.aborted) return;

			// 3. Update State & Cache
			// 无论当前是否选中，都写入缓存
			await agentPreviewState.setFileContent(
				currentSandboxId,
				currentSessionId,
				file.path,
				content,
				file.modified_time,
			);

			if (isFileStillSelected(currentFilePath, fileViewer.selectedFile)) {
				await agentPreviewState.setSelectedFilePath(currentSandboxId, currentSessionId, file.path);
				fileViewer.content = content;
			}
		} catch (e) {
			if (!signal.aborted && isFileStillSelected(currentFilePath, fileViewer.selectedFile)) {
				handleError(e, "Failed to load file content");
				console.error("[AgentPreview] File load error:", e);
			}
		} finally {
			if (!signal.aborted) fileViewer.isLoading = false;
		}
	}

	function handleFileDelete(file: SandboxFileInfo) {
		if (!fileViewer.selectedFile) return;

		const isExactMatch = fileViewer.selectedFile.path === file.path;
		const isParentDir =
			file.type === "dir" && fileViewer.selectedFile.path.startsWith(file.path + "/");

		if (isExactMatch || isParentDir) {
			fileViewer.selectedFile = null;
			fileViewer.content = "";
		}
	}

	// 提取通用的 Deploy 验证逻辑
	function validateDeployPreconditions() {
		const validation = validate302Provider(persistedProviderState.current);
		if (!validation.valid || !validation.provider) {
			const errorMsg =
				validation.error === "toast_deploy_no_302_provider"
					? m.toast_deploy_no_302_provider()
					: validation.error === "toast_deploy_302_provider_disabled"
						? m.toast_deploy_302_provider_disabled()
						: validation.error || m.toast_deploy_failed();
			toast.error(errorMsg);
			return null;
		}
		return validation.provider;
	}

	async function handleDeployCommon(
		deployAction: (
			provider: ModelProvider,
		) => Promise<{ success: boolean; data?: { url: string; id?: string }; error?: string }>,
		successMsg: string,
	) {
		const provider = validateDeployPreconditions();
		if (!provider) return;

		deployment.isDeploying = true;
		try {
			const result = await deployAction(provider);

			if (!result.success || !result.data) {
				throw new Error(result.error || "Unknown error");
			}

			// Update local state
			if (result.data.url) {
				deployment.url = result.data.url;
				iframeRefreshKey++;
				if (result.data.id) deployment.deploymentId = result.data.id;

				try {
					await navigator.clipboard.writeText(result.data.url);
				} catch (e) {
					console.warn("Clipboard write failed:", e);
				}
				toast.success(successMsg);
			}
			return result.data;
		} catch (error) {
			console.error("Deploy failed:", error);
			const rawMessage = error instanceof Error ? error.message : "Unknown error";
			const truncatedMessage =
				rawMessage.length > 300 ? rawMessage.slice(0, 300) + "..." : rawMessage;
			toast.error(`${m.toast_deploy_failed()}: ${truncatedMessage}`);
		} finally {
			deployment.isDeploying = false;
		}
	}

	const handleDeploy = () =>
		handleDeployCommon(
			(provider) =>
				deployHtmlTo302(provider, {
					html: htmlPreviewState.editedHtml,
					title: "HTML Preview Deploy",
					description: "Deployed from 302 AI Studio",
				}),
			m.toast_deploy_success(),
		);

	const handleDeploySandbox = async () => {
		// Set /deploy command in the chat input and send it
		// This is equivalent to typing /deploy in the chat input and pressing enter
		chatState.inputValue = "/deploy";

		// Send the message immediately
		await chatState.sendMessage();
	};

	const handleOpenInNewTab = async () => {
		// In agent mode, if we have a deployment URL, create a new tab with iframe
		if (isAgentMode && deployment.url && currentSandboxId && currentSessionId) {
			// Create HTML content with iframe pointing to deployment URL
			const htmlContent = `<iframe src="${deployment.url}" style="width: 100%; height: 100%; border: 0;" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals" referrerpolicy="no-referrer"></iframe>`;

			// Generate unique previewId based on sandboxId and sessionId
			const previewId = `agent-preview-${currentSandboxId}-${currentSessionId}`;

			await tabBarState.handleNewTab(
				m.title_html_preview(),
				"htmlPreview",
				true,
				"/html-preview",
				htmlContent,
				previewId,
			);
			return;
		}

		// Otherwise, use the HTML preview logic (for non-agent mode)
		const previewId = htmlPreviewState.context
			? `${htmlPreviewState.context.messageId}-${htmlPreviewState.context.messagePartIndex}-${htmlPreviewState.context.blockId}`
			: undefined;

		await tabBarState.handleNewTab(
			m.title_html_preview(),
			"htmlPreview",
			true,
			"/html-preview",
			htmlPreviewState.editedHtml,
			previewId,
		);
	};

	const handleCopyDeploymentUrl = async () => {
		if (!isAgentMode || !deployment.url) return;
		try {
			await navigator.clipboard.writeText(deployment.url);
			toast.success(m.toast_deploy_url_copied());
		} catch (_e) {
			toast.error(m.toast_copied_failed());
		}
	};

	const handleRefreshPreview = () => {
		if (!isAgentMode || !deployment.url) return;
		iframeRefreshKey++;
	};

	// --- Edit Handlers ---

	const handleStartEdit = () => {
		editContent = fileViewer.content;
		isEditing = true;
	};

	const handleCancelEdit = () => {
		isEditing = false;
		editContent = "";
	};

	const handleSaveEdit = async () => {
		if (!currentSandboxId || !currentSessionId || !fileViewer.selectedFile) return;

		const apiKey = get302ApiKey();
		if (!apiKey) {
			toast.error(m.toast_deploy_no_302_provider());
			return;
		}

		const loadingId = toast.loading(m.toast_file_uploading());
		isSaving = true;

		try {
			// Ensure we have content to upload
			if (typeof editContent !== "string") {
				throw new Error("Invalid content type");
			}

			// Explicitly use the path from the selected file
			const filePath = fileViewer.selectedFile.path;

			// Convert editContent (string) to Blob, then to File
			const blob = new Blob([editContent], { type: "text/plain" });
			const file = new File([blob], fileViewer.selectedFile.name, {
				type: "text/plain",
				lastModified: Date.now(),
			});

			console.log("[AgentPreview] Uploading file:", {
				path: filePath,
				name: file.name,
				size: file.size,
				type: file.type,
			});

			const response = await uploadSandboxFile(currentSandboxId, filePath, file, apiKey);

			if (response.success) {
				// Update local cache and view
				await agentPreviewState.setFileContent(
					currentSandboxId,
					currentSessionId,
					filePath,
					editContent,
				);

				// Update local viewer state
				fileViewer.content = editContent;
				isEditing = false;

				toast.success(m.toast_file_upload_success(), { id: loadingId });
			}
		} catch (e) {
			console.error("Save edit failed:", e);
			toast.error(m.toast_file_upload_failed(), { id: loadingId });
		} finally {
			isSaving = false;
		}
	};
</script>

<div class="h-full">
	{#if agentPreviewState.isVisible}
		<div
			class="flex flex-col h-full min-w-0 max-w-full overflow-hidden border-l border-border bg-background"
			style="container-type: inline-size;"
		>
			<PreviewHeader
				{activeTab}
				{tabs}
				{deviceMode}
				isDeploying={deployment.isDeploying}
				deployedUrl={isAgentMode ? deployment.url : null}
				compactDeployButton={false}
				isPinned={agentPreviewState.isPinned}
				isStreaming={chatState.isStreaming}
				onTabChange={(t) => (activeTab = t as TabType)}
				onDeviceModeChange={(d) => (deviceMode = d)}
				onDeploy={isAgentMode ? handleDeploySandbox : handleDeploy}
				onClose={() => agentPreviewState.closePreview()}
				onOpenDeployedUrl={() =>
					isAgentMode && deployment.url && window.open(deployment.url, "_blank")}
				onOpenInNewTab={handleOpenInNewTab}
				onCopyDeployedUrl={handleCopyDeploymentUrl}
				onRefreshPreview={isAgentMode ? handleRefreshPreview : undefined}
				onPin={() => agentPreviewState.togglePin()}
				{isAgentMode}
				isDeleted={codeAgentState.isDeleted}
			/>

			<div class="flex flex-1 min-w-0 min-h-0">
				{#if codeAgentState.isDeleted && activeTab === TAB_CODE}
					<!-- When deleted on CODE tab, show SessionDeleted full-width without file tree -->
					<div class="flex-1 flex items-center justify-center">
						<SessionDeleted />
					</div>
				{:else}
					<!-- Normal layout with file tree and code area -->
					<div
						class="flex-shrink flex-1 max-w-64 min-w-[100px] border-r border-border overflow-hidden {activeTab ===
						TAB_CODE
							? ''
							: 'hidden'}"
					>
						<FileTree
							sandboxId={currentSandboxId}
							workspacePath={claudeCodeSandboxState.currentSessionWorkspacePath}
							onFileSelect={handleFileSelect}
							{refreshTrigger}
							onFileDelete={handleFileDelete}
						/>
					</div>

					<div class="flex-1 flex flex-col min-w-[140px] min-h-0">
						{#if activeTab === TAB_PREVIEW}
							{#if isAgentMode}
								{#if isRestoringState}
									<div class="flex h-full items-center justify-center">
										<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
									</div>
								{:else if deployment.url}
									<div class="flex-1 overflow-auto bg-muted/30 min-h-0">
										<div
											class="h-full w-full mx-auto transition-all duration-300 ease-in-out
                              {deviceMode === DEVICE_MODE_MOBILE ? 'max-w-[375px]' : ''}"
										>
											{#key iframeRefreshKey}
												<iframe
													class="w-full h-full border-0 {deviceMode === DEVICE_MODE_MOBILE
														? 'shadow-lg border-x border-border'
														: ''}"
													sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
													referrerpolicy="no-referrer"
													title="Sandbox Preview"
													src={deployment.url}
												></iframe>
											{/key}
										</div>
									</div>
								{:else if codeAgentState.isDeleted}
									<SessionDeleted />
								{:else}
									<div
										class="flex h-full flex-col items-center justify-start pt-20 text-muted-foreground"
									>
										<img src={UnDeployedIcon} alt="Un deployed" class="h-40 w-40" />
										<p class="text-sm font-medium">{m.empty_agent_preview_title()}</p>
										<Button
											class=" flex rounded-xs items-center gap-1.5 mt-3.5   bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
											onclick={handleDeploySandbox}
											disabled={deployment.isDeploying || chatState.isStreaming}
										>
											{#if deployment.isDeploying}
												<Loader2 class="h-4 w-4 animate-spin" />
												{m.text_deploying()}
											{:else}
												{m.button_click_to_deploy()}
											{/if}
										</Button>
									</div>
								{/if}
							{:else if fileViewer.selectedFile}
								<PreviewPanel html={fileViewer.content} {deviceMode} />
							{:else if codeAgentState.isDeleted}
								<SessionDeleted />
							{:else}
								<div class="flex h-full items-center justify-center text-muted-foreground text-sm">
									{m.empty_html_preview_title()}
								</div>
							{/if}
						{:else if activeTab === TAB_CODE}
							{#if fileViewer.selectedFile}
								<div class="flex-1 flex flex-col min-h-0">
									{#if !fileViewer.isLoading}
										<div
											class="flex items-center justify-end gap-2 border-b border-border bg-background px-3 py-2"
										>
											{#if isEditing}
												<div class="flex items-center gap-2">
													<button
														class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
														onclick={handleCancelEdit}
														disabled={isSaving}
														title={m.text_button_cancel()}
													>
														<X class="h-4 w-4 flex-shrink-0" />
														<!-- <span class="whitespace-nowrap">{m.text_button_cancel()}</span> -->
													</button>
													<button
														class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
														onclick={handleSaveEdit}
														disabled={isSaving}
														title={isSaving ? m.text_button_saving() : m.text_button_save()}
													>
														{#if isSaving}
															<Loader2 class="h-4 w-4 flex-shrink-0 animate-spin" />
														{:else}
															<Save class="h-4 w-4 flex-shrink-0" strokeWidth={1.25} />
														{/if}
													</button>
												</div>
											{:else}
												<button
													class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
													onclick={handleStartEdit}
												>
													<Pencil class="h-4 w-4" strokeWidth={1.25} />
													<!-- {m.text_button_edit()} -->
												</button>
											{/if}
										</div>
									{/if}

									<div class="flex-1 min-h-0">
										{#if fileViewer.isLoading}
											<div class="flex h-full items-center justify-center">
												<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
											</div>
										{:else}
											<CodeMirrorEditor
												value={isEditing ? editContent : fileViewer.content}
												language={fileViewer.language}
												readOnly={!isEditing}
												onChange={(val) => {
													if (isEditing) editContent = val;
												}}
											/>
										{/if}
									</div>
								</div>
							{:else}
								<div class="flex h-full items-center justify-center text-muted-foreground text-sm">
									{m.empty_html_preview_title()}
								</div>
							{/if}
						{:else if activeTab === TAB_TERMINAL && isAgentMode}
							{#if codeAgentState.isDeleted}
								<SessionDeleted />
							{:else if currentSandboxId}
								<Terminal sandboxId={currentSandboxId} sessionId={currentSessionId} />
							{:else}
								<div class="flex h-full items-center justify-center text-muted-foreground text-sm">
									Sandbox not available
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
