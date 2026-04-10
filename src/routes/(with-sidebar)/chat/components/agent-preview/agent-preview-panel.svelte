<script lang="ts">
	import {
		downloadSandboxFile,
		getFileContent,
		uploadSandboxFile,
		type SandboxFileInfo,
	} from "$lib/api/sandbox-file";
	import type { ListSkillsResponse } from "$lib/api/skills/base-apis";
	import { deployHtmlTo302, validate302Provider } from "$lib/api/webserve-deploy";
	import UnDeployedIcon from "$lib/assets/icons/code-agent/unDeployed.svg";
	import CodeMirrorEditor from "$lib/components/buss/editor/codemirror-editor.svelte";
	import SkillsPanelHeader from "$lib/components/buss/skill-list/skills-panel-header.svelte";
	import SkillCreateGithubView from "$lib/components/buss/skill-list/views/skill-create-github-view.svelte";
	import SkillCreateHistoryView from "$lib/components/buss/skill-list/views/skill-create-history-view.svelte";
	import SkillCreateManualView from "$lib/components/buss/skill-list/views/skill-create-manual-view.svelte";
	import SkillCreateSelectView from "$lib/components/buss/skill-list/views/skill-create-select-view.svelte";
	import SkillCreateUploadView from "$lib/components/buss/skill-list/views/skill-create-upload-view.svelte";
	import SkillDetailView from "$lib/components/buss/skill-list/views/skill-detail-view.svelte";
	import SkillEditView from "$lib/components/buss/skill-list/views/skill-edit-view.svelte";
	import SkillPreviewView from "$lib/components/buss/skill-list/views/skill-preview-view.svelte";
	import SkillsListView from "$lib/components/buss/skill-list/views/skills-list-view.svelte";
	import PreviewHeader, { type PreviewTab } from "$lib/components/chat/preview-header.svelte";
	import PreviewPanel from "$lib/components/html-preview/preview-panel.svelte";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";

	import Button from "$lib/components/ui/button/button.svelte";
	import * as m from "$lib/paraglide/messages";
	import {
		agentPreviewState,
		type AgentPreviewSyncEnvelope,
	} from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { cloudModeState } from "$lib/stores/code-agent/cloud-mode-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";

	import { TaskboardPanel } from "$lib/components/buss/taskboard";
	import { htmlPreviewState } from "$lib/stores/html-preview-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { tabBarState } from "$lib/stores/tab-bar-state.svelte";
	import { Check, Copy, Download, FileWarning, Loader2, Pencil, Save, X } from "@lucide/svelte";
	import { createLogger } from "@shared/logger";
	import type { ModelProvider, Skill } from "@shared/types";
	import { onDestroy, untrack } from "svelte";
	import { toast } from "svelte-sonner";
	import {
		DEVICE_MODE_DESKTOP,
		DEVICE_MODE_MOBILE,
		TAB_CODE,
		TAB_OPENCLAW_WEBUI,
		TAB_PREVIEW,
		TAB_SKILLS,
		TAB_TASKBOARD,
		TAB_TERMINAL,
		type DeviceMode,
		type TabType,
	} from "./constants";
	import FileTree from "./file-tree.svelte";
	import OpenClawWebUI from "./openclaw-webui.svelte";
	import SessionDeleted from "./session-deleted.svelte";
	import Terminal from "./terminal.svelte";
	import { handleError, isFileStillSelected } from "./utils";

	const logger = createLogger("ui");

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

	// File type detection
	type FilePreviewType = "text" | "image" | "pdf" | "video" | "audio" | "unsupported";

	const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "ico", "svg"];
	const VIDEO_EXTENSIONS = ["mp4", "webm", "ogg", "mov", "avi"];
	const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "flac", "aac", "m4a"];
	const PDF_EXTENSIONS = ["pdf"];
	const TEXT_EXTENSIONS = [
		"txt",
		"md",
		"markdown",
		"json",
		"jsonc",
		"js",
		"jsx",
		"ts",
		"tsx",
		"css",
		"scss",
		"sass",
		"less",
		"html",
		"htm",
		"xml",
		"svg",
		"yml",
		"yaml",
		"toml",
		"ini",
		"cfg",
		"conf",
		"sh",
		"bash",
		"bat",
		"ps1",
		"py",
		"rb",
		"go",
		"rs",
		"java",
		"c",
		"cpp",
		"h",
		"hpp",
		"cs",
		"php",
		"swift",
		"kt",
		"scala",
		"sql",
		"graphql",
		"vue",
		"svelte",
		"astro",
		"log",
		"env",
		"gitignore",
		"dockerfile",
		"makefile",
		"license",
		"readme",
	];

	function detectFilePreviewType(filename: string): FilePreviewType {
		const ext = filename.split(".").pop()?.toLowerCase() || "";
		const nameWithoutExt = filename.toLowerCase();

		if (IMAGE_EXTENSIONS.includes(ext)) return "image";
		if (VIDEO_EXTENSIONS.includes(ext)) return "video";
		if (AUDIO_EXTENSIONS.includes(ext)) return "audio";
		if (PDF_EXTENSIONS.includes(ext)) return "pdf";
		if (
			TEXT_EXTENSIONS.includes(ext) ||
			TEXT_EXTENSIONS.some((t) => nameWithoutExt.endsWith(t))
		) {
			return "text";
		}

		// For files without extension or unknown extensions, try to treat as text
		// Common files without extensions
		if (
			["makefile", "dockerfile", "gemfile", "rakefile", "procfile"].includes(nameWithoutExt)
		) {
			return "text";
		}

		return "unsupported";
	}

	function detectLanguage(filename: string): string {
		const ext = filename.split(".").pop()?.toLowerCase();
		return LANGUAGE_MAP[ext || ""] || "text";
	}

	function resolvePreviewActiveTab(
		availableTabs: ReadonlyArray<PreviewTab>,
		currentTab: TabType,
	): TabType | null {
		if (availableTabs.length === 0) {
			return null;
		}

		return availableTabs.some((tab) => tab.id === currentTab)
			? currentTab
			: (availableTabs[0].id as TabType);
	}

	// --- State ---
	// Sync activeTab with agentPreviewState
	let activeTab = $derived(agentPreviewState.activeTab as TabType);
	let deviceMode = $state<DeviceMode>(DEVICE_MODE_DESKTOP);

	// Skills data
	let skillsData = $state<Omit<ListSkillsResponse, "success" | "project_skills">>({
		builtin_skills: [],
		user_skills: [],
	});

	function findSkill(skillName: string): Skill | undefined {
		return (
			skillsData.user_skills.find((s) => s.name === skillName) ||
			skillsData.builtin_skills.find((s) => s.name === skillName)
		);
	}

	function updateSkillFavoriteState(
		skillName: string,
		is_favorite: boolean,
		favorite_at: string | null,
	) {
		const updateSkills = (skills: Skill[]) =>
			skills.map((skill) =>
				skill.name === skillName ? { ...skill, is_favorite, favorite_at } : skill,
			);

		skillsData = {
			...skillsData,
			user_skills: updateSkills(skillsData.user_skills),
			builtin_skills: updateSkills(skillsData.builtin_skills),
		};
	}

	async function loadSkills() {
		const data = await codeAgentState.getSkillList(false);
		skillsData = data;
	}

	// Load skills when switching to skills tab
	$effect(() => {
		if (activeTab === TAB_SKILLS) {
			loadSkills();
		}
	});

	// Grouped Deployment State
	let deployment = $state({
		url: null as string | null,
		deploymentId: null as string | null,
	});

	// Grouped File Viewer State
	let fileViewer = $state({
		selectedFile: null as SandboxFileInfo | null,
		content: "",
		isLoading: false,
		language: "text",
		previewType: "text" as FilePreviewType,
		previewUrl: null as string | null, // For image/video/audio/pdf blob URLs
	});
	let syncUnsubscribe: (() => void) | null = null;

	let refreshTrigger = $state(0);
	let iframeRefreshKey = $state(0);

	// Edit State
	let isEditing = $state(false);
	let isSaving = $state(false);
	let editContent = $state("");

	// Copy State
	let isCopied = $state(false);
	let copyTimeoutId: NodeJS.Timeout | null = null;

	// Internal logic variables (non-reactive)
	let abortController: AbortController | null = null;
	let isRestoringState = $state(false); // Track loading state for UI
	let previousStreamingState = false; // 用于追踪流式状态边缘
	let deploymentIframeRef: HTMLIFrameElement | null = $state(null);

	// --- Derived ---
	const isAgentMode = $derived(codeAgentState.enabled);
	const currentSandboxId = $derived(codeAgentState.sandboxId);
	const currentSessionId = $derived.by(() => {
		// If currentSessionId matches one of the known valid sessionIds, use it
		if (
			codeAgentState.currentSessionId
			// &&
			// codeAgentState.sessionIds.some(
			// 	(s) => getId(s) === codeAgentState.currentSessionId,
			// )
		) {
			return codeAgentState.currentSessionId;
		}
		// Otherwise fallback to the first available session ID (assuming single active session in most cases)
		// const firstValidSession = codeAgentState.sessionIds.find((s) => getId(s));
		// if (firstValidSession) {
		// 	return getId(firstValidSession);
		// }
		return "";
	});

	// Skills-only mode: only show skills tab when no sandbox
	const isSkillsOnlyMode = $derived(agentPreviewState.isSkillsOnlyMode);

	// Tabs definition
	let tabs: PreviewTab[] = $derived.by(() => {
		if (codeAgentState.currentAgentId === "open-claw") {
			// No active session yet: only show Skills/Taskboard/Manage tabs (no sandbox required)
			if (!codeAgentState.inCodeAgentMode) {
				return [
					{ id: TAB_SKILLS, label: "Skills" },
					{ id: TAB_TASKBOARD, label: m.label_tab_taskboard() },
					{ id: TAB_OPENCLAW_WEBUI, label: m.label_tab_manage() },
				];
			}

			const openClawTabs: PreviewTab[] = [
				{ id: TAB_PREVIEW, label: m.label_tab_preview() },
				{ id: TAB_CODE, label: m.label_tab_file() },
				{ id: TAB_TERMINAL, label: m.label_tab_terminal() },
				{ id: TAB_SKILLS, label: "Skills" },
				{ id: TAB_TASKBOARD, label: m.label_tab_taskboard() },
				{ id: TAB_OPENCLAW_WEBUI, label: m.label_tab_manage() },
			];

			return openClawTabs;
		}

		// Skills-only mode OR no sandbox: show skills and taskboard tabs
		if (isSkillsOnlyMode || !currentSandboxId) {
			return [
				{ id: TAB_SKILLS, label: "Skills" },
				{ id: TAB_TASKBOARD, label: m.label_tab_taskboard() },
			];
		}

		const t = [
			{ id: "preview", label: m.label_tab_preview() },
			{ id: "code", label: m.label_tab_file() },
		];
		if (isAgentMode) {
			t.push({ id: TAB_TERMINAL, label: m.label_tab_terminal() });
			t.push({ id: TAB_SKILLS, label: "Skills" });
			t.push({ id: TAB_TASKBOARD, label: m.label_tab_taskboard() });
		}
		return t;
	});

	// --- Effects & Logic ---

	// 0. 保证当前 tab 始终落在当前模式可用的范围内
	$effect(() => {
		const normalizedTab = resolvePreviewActiveTab(tabs, activeTab);
		if (normalizedTab && normalizedTab !== activeTab) {
			agentPreviewState.setActiveTab(normalizedTab);
		}
	});

	// 0.1 Reset isSkillsOnlyMode when streaming starts
	// This shows all tabs (Preview, Files, Terminal) when the AI begins responding
	$effect(() => {
		if (chatState.isStreaming && isSkillsOnlyMode) {
			agentPreviewState.isSkillsOnlyMode = false;
		}
	});

	// Close preview when agent mode is disabled
	$effect(() => {
		if (!codeAgentState.enabled) {
			untrack(() => {
				agentPreviewState.closePreview();
			});
		}
	});

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

			// Deployment updates are handled by a dedicated sync event and should refresh
			// preview immediately in both current window and other windows.
			if (message.type === "deploymentUpdated") {
				deployment.url = message.url;
				deployment.deploymentId = message.deploymentId;
				// Clean up old iframe before refresh
				if (deploymentIframeRef) {
					deploymentIframeRef.src = "about:blank";
				}
				iframeRefreshKey++;
				return;
			}

			// Handle file deletion: when file list is updated, check if the currently
			// previewed file was deleted (directly or as part of a deleted folder)
			// This must be checked for ALL sources (including self) to handle same-window deletions
			if (message.type === "fileListUpdated" && fileViewer.selectedFile) {
				const currentPath = fileViewer.selectedFile.path;
				const fileStillExists = message.fileList.some((f) => f.path === currentPath);
				const syncDir = message.fileTreeCurrentDirectory;

				// If file exists, we don't do anything (it's safe)
				// If file is missing (!fileStillExists), we need to decide if it's actually deleted
				// or just not in the current view (because we navigated to a different directory)
				if (!fileStillExists) {
					let shouldClear = false; // Default to FALSE (safer)

					if (syncDir) {
						// We have directory context
						const normalizeSyncDir = syncDir.endsWith("/") ? syncDir : `${syncDir}/`;
						const normalizeFileDir = currentPath.substring(
							0,
							currentPath.lastIndexOf("/") + 1,
						);
						const isDirectChild = normalizeFileDir === normalizeSyncDir;

						if (isDirectChild) {
							// If it WAS a direct child (should be in this list) and is missing, it is deleted.
							shouldClear = true;
						}
					} else {
						// No context.
						logger.warn("Missing syncDir context, skipping clear check.");
					}

					if (shouldClear) {
						logger.debug("Clearing preview");
						// Clear preview state for deleted file
						cleanupPreviewUrl();
						fileViewer.selectedFile = null;
						fileViewer.content = "";
						fileViewer.previewType = "text";
					}
				}
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

		// Set isRestoringState immediately to prevent race conditions
		// This must be set before any async operations to block concurrent calls
		isRestoringState = true;

		try {
			await codeAgentState.refreshSessions(sandboxId);

			const [info, savedPath] = await Promise.all([
				agentPreviewState.getDeploymentInfo(sandboxId, sessionId),
				agentPreviewState.getSelectedFilePath(sandboxId, sessionId),
			]);

			deployment.url = info?.url ?? null;
			deployment.deploymentId = info?.deploymentId ?? null;

			if (savedPath) {
				// Load storage first to get file info with updated modified_time
				const storage = await agentPreviewState.loadFromStorage(sandboxId, sessionId);
				const file = storage?.fileList?.find((f) => f.path === savedPath);

				if (file) {
					const currentlySelectedPath = fileViewer.selectedFile?.path;
					const isAlreadySelected = currentlySelectedPath === savedPath;
					const isModified =
						isAlreadySelected &&
						fileViewer.selectedFile?.modified_time !== file.modified_time;

					// Only reload if:
					// 1. File was modified (modified_time changed) - reload to show new content
					// 2. No file is currently selected - restore saved selection on panel open
					// Do NOT reload if user just selected a different file (would abort their selection)
					if (isModified || !currentlySelectedPath) {
						await handleFileSelect(file);
					}
				}
			}

			// Mark as restored only after successful completion
			lastRestoredKey = key;
		} catch (e) {
			logger.warn("State restore failed (ignored):", e);
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
				logger.debug("Task completed, triggering refresh");
				refreshTrigger++;

				// Refresh sessions to get updated workspace_path after agent completes
				// This is important because session/workspace is created after agent's first response
				if (codeAgentState.type === "local") {
					codeAgentState.refreshSessions();
				} else {
					codeAgentState.refreshSessions(currentSandboxId);
				}
			}
		}
		previousStreamingState = isStreaming;
	});

	// 3. Refresh file tree and current file when switching to code tab
	let previousActiveTab: TabType | null = null;
	$effect(() => {
		const currentTab = activeTab;
		// 当从其他 tab 切换到 code tab 时，刷新文件树和当前文件内容
		if (
			previousActiveTab !== null &&
			previousActiveTab !== TAB_CODE &&
			currentTab === TAB_CODE
		) {
			if (isAgentMode && currentSandboxId && currentSessionId) {
				// 1. 刷新文件树列表
				refreshTrigger++;

				// 2. 如果有已选中的文件，清除其缓存并重新加载内容
				if (fileViewer.selectedFile) {
					const selectedFile = fileViewer.selectedFile;
					// 清除所有文件内容缓存，确保获取最新内容
					agentPreviewState
						.clearFileContents(currentSandboxId, currentSessionId)
						.then(() => {
							// 重新加载当前文件
							handleFileSelect(selectedFile);
						});
				}
			}
		}
		previousActiveTab = currentTab;
	});

	// Cleanup on unmount
	onDestroy(() => {
		abortController?.abort();
		cleanupPreviewUrl();
		if (syncUnsubscribe) {
			syncUnsubscribe();
			syncUnsubscribe = null;
		}
		if (copyTimeoutId) {
			clearTimeout(copyTimeoutId);
		}
		// Clean up deployment iframe to prevent zombie renderer
		if (deploymentIframeRef) {
			deploymentIframeRef.src = "about:blank";
			deploymentIframeRef = null;
		}
	});

	// --- Handlers ---

	const get302ApiKey = () => {
		const provider = persistedProviderState.current.find(
			(p) => p.name === "302.AI" && p.enabled,
		);
		return provider?.apiKey || "";
	};

	// Clean up previous blob URL
	function cleanupPreviewUrl() {
		if (fileViewer.previewUrl) {
			URL.revokeObjectURL(fileViewer.previewUrl);
			fileViewer.previewUrl = null;
		}
	}

	async function handleFileSelect(file: SandboxFileInfo) {
		abortController?.abort();
		abortController = new AbortController();
		const signal = abortController.signal;

		// Clean up previous preview URL
		cleanupPreviewUrl();

		// Detect file preview type
		const previewType = detectFilePreviewType(file.name);

		// 立即更新 UI 状态
		fileViewer.selectedFile = file;
		fileViewer.isLoading = true;
		fileViewer.language = detectLanguage(file.name);
		fileViewer.previewType = previewType;
		fileViewer.content = "";
		const currentFilePath = file.path;

		try {
			if (!currentSandboxId || !currentSessionId) throw new Error("No sandbox/session");

			const apiKey = get302ApiKey();
			if (!apiKey) throw new Error("302.AI API key not found");

			// Handle different file types
			if (previewType === "text") {
				// Text files: use existing logic with cache
				const cachedContent = await agentPreviewState.getFileContent(
					currentSandboxId,
					currentSessionId,
					file.path,
					file.modified_time,
				);

				if (signal.aborted) return;

				if (
					cachedContent &&
					isFileStillSelected(currentFilePath, fileViewer.selectedFile)
				) {
					await agentPreviewState.setSelectedFilePath(
						currentSandboxId,
						currentSessionId,
						file.path,
					);
					fileViewer.content = cachedContent;
					fileViewer.isLoading = false;
					return;
				}

				// Fetch from API
				const content = await getFileContent(currentSandboxId!, file.path, signal);

				if (signal.aborted) return;

				// Update State & Cache
				await agentPreviewState.setFileContent(
					currentSandboxId,
					currentSessionId,
					file.path,
					content,
					file.modified_time,
				);

				if (isFileStillSelected(currentFilePath, fileViewer.selectedFile)) {
					await agentPreviewState.setSelectedFilePath(
						currentSandboxId,
						currentSessionId,
						file.path,
					);
					fileViewer.content = content;
				}
			} else if (
				previewType === "image" ||
				previewType === "video" ||
				previewType === "audio" ||
				previewType === "pdf"
			) {
				// Binary files: download and create blob URL with retry
				const response = await downloadSandboxFile(currentSandboxId!, file.path);

				if (signal.aborted) return;

				let blob: Blob | null = null;

				// Determine the correct MIME type based on file extension
				const ext = file.name.split(".").pop()?.toLowerCase() || "";
				const mimeTypeMap: Record<string, string> = {
					// Images
					jpg: "image/jpeg",
					jpeg: "image/jpeg",
					png: "image/png",
					gif: "image/gif",
					webp: "image/webp",
					bmp: "image/bmp",
					ico: "image/x-icon",
					svg: "image/svg+xml",
					// Videos
					mp4: "video/mp4",
					webm: "video/webm",
					ogg: "video/ogg",
					mov: "video/quicktime",
					avi: "video/x-msvideo",
					// Audio
					mp3: "audio/mpeg",
					wav: "audio/wav",
					flac: "audio/flac",
					aac: "audio/aac",
					m4a: "audio/mp4",
					// Documents
					pdf: "application/pdf",
				};
				const mimeType = mimeTypeMap[ext] || "application/octet-stream";

				if (response._blobContent) {
					// Re-create blob with correct MIME type if needed
					if (response._blobContent.type !== mimeType) {
						const arrayBuffer = await response._blobContent.arrayBuffer();
						blob = new Blob([arrayBuffer], { type: mimeType });
					} else {
						blob = response._blobContent;
					}
				} else if (response._directContent) {
					// If we got text content, convert to blob
					blob = new Blob([response._directContent], { type: mimeType });
				} else {
					// Check for download_url in the response (API may return this format)
					const jsonResponse = response as unknown as { download_url?: string };
					let downloadUrl: string | null = null;

					if (jsonResponse.download_url) {
						downloadUrl = jsonResponse.download_url;
					} else if (
						response.result?.[0]?.file_list?.[0]?.upload_url &&
						response.result[0].file_list[0].upload_url !== ""
					) {
						downloadUrl = response.result[0].file_list[0].upload_url;
					}

					if (downloadUrl) {
						const fileResponse = await fetch(downloadUrl, { signal });
						if (!fileResponse.ok) {
							throw new Error(`Failed to download file: ${fileResponse.statusText}`);
						}
						const arrayBuffer = await fileResponse.arrayBuffer();
						blob = new Blob([arrayBuffer], { type: mimeType });
					}
				}

				if (signal.aborted) return;

				if (blob && isFileStillSelected(currentFilePath, fileViewer.selectedFile)) {
					const blobUrl = URL.createObjectURL(blob);
					fileViewer.previewUrl = blobUrl;
					await agentPreviewState.setSelectedFilePath(
						currentSandboxId,
						currentSessionId,
						file.path,
					);
				}
			}
			// For unsupported types, just update the selection without loading content
			else if (isFileStillSelected(currentFilePath, fileViewer.selectedFile)) {
				await agentPreviewState.setSelectedFilePath(
					currentSandboxId,
					currentSessionId,
					file.path,
				);
			}
		} catch (e) {
			if (!signal.aborted && isFileStillSelected(currentFilePath, fileViewer.selectedFile)) {
				handleError(e, "Failed to load file content");
				logger.error("File load error:", e);
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
			cleanupPreviewUrl();
			fileViewer.selectedFile = null;
			fileViewer.content = "";
			fileViewer.previewType = "text";
		}
	}

	// 提取通用的 Deploy 验证逻辑
	function validateDeployPreconditions() {
		const validation = validate302Provider(persistedProviderState.current);
		if (!validation.valid) {
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

		agentPreviewState.isDeploying = true;
		try {
			const result = await deployAction(provider);

			if (!result.success || !result.data) {
				throw new Error(result.error || "Unknown error");
			}

			// Update local state
			if (result.data.url) {
				deployment.url = result.data.url;
				// Clean up old iframe before refresh
				if (deploymentIframeRef) {
					deploymentIframeRef.src = "about:blank";
				}
				iframeRefreshKey++;
				if (result.data.id) deployment.deploymentId = result.data.id;

				try {
					await navigator.clipboard.writeText(result.data.url);
				} catch (e) {
					logger.warn("Clipboard write failed:", e);
				}
				toast.success(successMsg);
			}
			return result.data;
		} catch (error) {
			logger.error("Deploy failed:", error);
			const rawMessage = error instanceof Error ? error.message : "Unknown error";
			const truncatedMessage =
				rawMessage.length > 300 ? rawMessage.slice(0, 300) + "..." : rawMessage;
			toast.error(`${m.toast_deploy_failed()}: ${truncatedMessage}`);
		} finally {
			agentPreviewState.isDeploying = false;
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
		if (activeTab === TAB_OPENCLAW_WEBUI) {
			try {
				const isCloud =
					codeAgentState.currentAgentId === "open-claw" &&
					codeAgentState.type === "cloud";
				const url = isCloud
					? await cloudModeState.getOpenClawWebUiUrl()
					: await window.electronAPI.openClawService.getOpenClawWebUiUrl();
				if (url) {
					await tabBarState.handleNewTab("OpenClaw", "openClawWebUi", true, url);
				} else {
					toast.error(m.openclaw_webui_failed_to_load());
				}
			} catch (error) {
				logger.error("Failed to open internal tab:", error);
				toast.error(m.openclaw_webui_failed_to_load());
			}
			return;
		}

		// In agent mode, if we have a deployment URL, create a new tab with iframe
		if (isAgentMode && deployment.url && currentSandboxId && currentSessionId) {
			// Create HTML content with iframe pointing to deployment URL
			const htmlContent = `<iframe src="${deployment.url}" style="width: 100%; height: 100%; border: 0;" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads" referrerpolicy="no-referrer"></iframe>`;

			// Generate unique previewId based on sandboxId and sessionId
			const previewId = `agent-preview-${currentSandboxId}-${currentSessionId}`;

			tabBarState.handleNewTab(
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

		tabBarState.handleNewTab(
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
		// Clean up old iframe before refresh
		if (deploymentIframeRef) {
			deploymentIframeRef.src = "about:blank";
		}
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

			logger.debug("Uploading file:", {
				path: filePath,
				name: file.name,
				size: file.size,
				type: file.type,
			});

			const response = await uploadSandboxFile(currentSandboxId, filePath, file);

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
			logger.error("Save edit failed:", e);
			toast.error(m.toast_file_upload_failed(), { id: loadingId });
		} finally {
			isSaving = false;
		}
	};

	const handleCopyContent = async () => {
		if (!fileViewer.content || fileViewer.previewType !== "text") return;

		try {
			await navigator.clipboard.writeText(fileViewer.content);
			toast.success(m.toast_copied_success());

			isCopied = true;
			if (copyTimeoutId) {
				clearTimeout(copyTimeoutId);
			}
			copyTimeoutId = setTimeout(() => {
				isCopied = false;
			}, 2000);
		} catch (_e) {
			toast.error(m.toast_copied_failed());
		}
	};

	const handleCopyImage = async () => {
		if (!fileViewer.previewUrl || fileViewer.previewType !== "image") return;

		try {
			const response = await fetch(fileViewer.previewUrl);
			const blob = await response.blob();

			// Convert to PNG if needed (clipboard API requires PNG for images)
			let pngBlob = blob;
			if (blob.type !== "image/png") {
				const img = new Image();
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");

				await new Promise<void>((resolve, reject) => {
					img.onload = () => {
						canvas.width = img.width;
						canvas.height = img.height;
						ctx?.drawImage(img, 0, 0);
						resolve();
					};
					img.onerror = reject;
					img.src = fileViewer.previewUrl!;
				});

				pngBlob = await new Promise<Blob>((resolve, reject) => {
					canvas.toBlob((b) => {
						if (b) resolve(b);
						else reject(new Error("Failed to convert to PNG"));
					}, "image/png");
				});
			}

			await navigator.clipboard.write([
				new ClipboardItem({
					"image/png": pngBlob,
				}),
			]);

			toast.success(m.toast_copied_success());

			isCopied = true;
			if (copyTimeoutId) {
				clearTimeout(copyTimeoutId);
			}
			copyTimeoutId = setTimeout(() => {
				isCopied = false;
			}, 2000);
		} catch (_e) {
			toast.error(m.toast_copied_failed());
		}
	};

	const handleDownloadFile = () => {
		if (!fileViewer.selectedFile) return;

		try {
			if (fileViewer.previewType === "text") {
				// Text files: create blob and download
				const blob = new Blob([fileViewer.content], { type: "text/plain" });
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = fileViewer.selectedFile.name;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
			} else if (fileViewer.previewUrl) {
				// Binary files: use existing blob URL
				const link = document.createElement("a");
				link.href = fileViewer.previewUrl;
				link.download = fileViewer.selectedFile.name;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
			}
			toast.success(
				m.toast_download_file_success({ fileName: fileViewer.selectedFile.name }),
			);
		} catch (e) {
			logger.error("Download failed:", e);
			toast.error(m.toast_download_failed());
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
				isDeploying={agentPreviewState.isDeploying}
				deployedUrl={isAgentMode ? deployment.url : null}
				compactDeployButton={false}
				isPinned={agentPreviewState.isPinned}
				isStreaming={chatState.isStreaming}
				onTabChange={(t) => agentPreviewState.setActiveTab(t as TabType)}
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
							workspacePath={codeAgentState.currentWorkspacePath}
							onFileSelect={handleFileSelect}
							{refreshTrigger}
							onFileDelete={handleFileDelete}
						/>
					</div>

					<div class="flex-1 flex flex-col min-w-[140px] min-h-0">
						{#if activeTab === TAB_PREVIEW}
							{#if isAgentMode}
								{#if isRestoringState || agentPreviewState.isDeploying}
									<div
										class="flex h-full flex-col gap-2 items-center justify-center"
									>
										<Loader2
											class="h-6 w-6 animate-spin text-muted-foreground"
										/>
										{#if agentPreviewState.isDeploying}
											<span class="text-sm text-muted-foreground"
												>{m.text_deploying()}...</span
											>
										{/if}
									</div>
								{:else if deployment.url}
									<div class="flex-1 overflow-auto bg-muted/30 min-h-0">
										<div
											class="h-full w-full mx-auto transition-all duration-300 ease-in-out
                              {deviceMode === DEVICE_MODE_MOBILE ? 'max-w-[375px]' : ''}"
										>
											{#key iframeRefreshKey}
												<iframe
													bind:this={deploymentIframeRef}
													class="w-full h-full border-0 {deviceMode ===
													DEVICE_MODE_MOBILE
														? 'shadow-lg border-x border-border'
														: ''}"
													sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
													referrerpolicy="no-referrer"
													title={m.title_sandbox_preview()}
													src={deployment.url}
												></iframe>
											{/key}
										</div>
									</div>
								{:else if codeAgentState.isDeleted}
									<SessionDeleted />
								{:else}
									<div
										class="flex h-full flex-col items-center justify-center text-muted-foreground"
									>
										<img
											src={UnDeployedIcon}
											alt="Un deployed"
											class="h-40 w-40"
										/>
										<p class="text-sm font-medium">
											{m.empty_agent_preview_title()}
										</p>
										<Button
											class=" flex rounded-xs items-center gap-1.5 mt-3.5 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
											onclick={handleDeploySandbox}
											disabled={agentPreviewState.isDeploying ||
												chatState.isStreaming}
										>
											{#if agentPreviewState.isDeploying}
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
								<div
									class="flex h-full items-center justify-center text-muted-foreground text-sm"
								>
									{m.empty_html_preview_title()}
								</div>
							{/if}
						{:else if activeTab === TAB_CODE}
							{#if fileViewer.selectedFile}
								<div class="flex-1 flex flex-col min-h-0">
									<!-- Toolbar for file operations -->
									{#if !fileViewer.isLoading}
										<div
											class="flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-2 min-w-0"
										>
											<!-- 左侧：文件路径 -->
											<div
												class="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden"
											>
												<span
													class="text-xs text-muted-foreground truncate"
													title={fileViewer.selectedFile?.path}
												>
													{fileViewer.selectedFile?.path}
												</span>
											</div>

											<!-- 右侧：操作按钮 -->
											<div class="flex items-center gap-2 shrink-0">
												{#if isEditing}
													<button
														class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
														onclick={handleCancelEdit}
														disabled={isSaving}
														title={m.text_button_cancel()}
													>
														<X class="h-4 w-4 flex-shrink-0" />
													</button>
													<button
														class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
														onclick={handleSaveEdit}
														disabled={isSaving}
														title={isSaving
															? m.text_button_saving()
															: m.text_button_save()}
													>
														{#if isSaving}
															<Loader2
																class="h-4 w-4 flex-shrink-0 animate-spin"
															/>
														{:else}
															<Save
																class="h-4 w-4 flex-shrink-0"
																strokeWidth={1.25}
															/>
														{/if}
													</button>
												{:else}
													<!-- Copy button - for text and image files -->
													{#if fileViewer.previewType === "text" || fileViewer.previewType === "image"}
														<button
															class="relative rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer h-6 w-6"
															onclick={fileViewer.previewType ===
															"image"
																? handleCopyImage
																: handleCopyContent}
															title={m.title_copy()}
														>
															<Check
																class="absolute inset-0 m-auto h-4 w-4 transition-all duration-200 ease-in-out {isCopied
																	? 'scale-100 opacity-100'
																	: 'scale-0 opacity-0'}"
																strokeWidth={1.25}
															/>
															<Copy
																class="absolute inset-0 m-auto h-4 w-4 transition-all duration-200 ease-in-out {isCopied
																	? 'scale-0 opacity-0'
																	: 'scale-100 opacity-100'}"
																strokeWidth={1.25}
															/>
														</button>
													{/if}
													<!-- Download button - for all file types -->
													<button
														class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
														onclick={handleDownloadFile}
														title={m.label_file_tree_download()}
													>
														<Download
															class="h-4 w-4"
															strokeWidth={1.25}
														/>
													</button>
													<!-- Edit button - only for text files -->
													{#if fileViewer.previewType === "text"}
														<button
															class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
															onclick={handleStartEdit}
															title={m.title_button_edit()}
														>
															<Pencil
																class="h-4 w-4"
																strokeWidth={1.25}
															/>
														</button>
													{/if}
												{/if}
											</div>
										</div>
									{/if}

									<div class="flex-1 min-h-0">
										{#if fileViewer.isLoading}
											<div class="flex h-full items-center justify-center">
												<Loader2
													class="h-6 w-6 animate-spin text-muted-foreground"
												/>
											</div>
										{:else if fileViewer.previewType === "text"}
											<CodeMirrorEditor
												value={isEditing ? editContent : fileViewer.content}
												language={fileViewer.language}
												readOnly={!isEditing}
												onChange={(val) => {
													if (isEditing) editContent = val;
												}}
											/>
										{:else if fileViewer.previewType === "image" && fileViewer.previewUrl}
											<div
												class="flex h-full w-full items-center justify-center overflow-auto bg-muted/30 p-4"
											>
												<img
													src={fileViewer.previewUrl}
													alt={fileViewer.selectedFile?.name || "Preview"}
													class="max-h-full max-w-full object-contain"
												/>
											</div>
										{:else if fileViewer.previewType === "video" && fileViewer.previewUrl}
											<div
												class="flex h-full w-full items-center justify-center overflow-auto bg-muted/30 p-4"
											>
												<video
													src={fileViewer.previewUrl}
													controls
													class="max-h-full max-w-full"
												>
													<track kind="captions" />
												</video>
											</div>
										{:else if fileViewer.previewType === "audio" && fileViewer.previewUrl}
											<div
												class="flex h-full w-full items-center justify-center bg-muted/30 p-4"
											>
												<audio
													src={fileViewer.previewUrl}
													controls
													class="w-full max-w-md"
												>
													Your browser does not support the audio element.
												</audio>
											</div>
										{:else if fileViewer.previewType === "pdf" && fileViewer.previewUrl}
											<div class="h-full w-full bg-white">
												<object
													data={fileViewer.previewUrl}
													type="application/pdf"
													class="h-full w-full"
													title={fileViewer.selectedFile?.name ||
														"PDF Preview"}
												>
													<div
														class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"
													>
														<FileWarning
															class="h-12 w-12"
															strokeWidth={1.25}
														/>
														<p class="text-sm">
															{m.document_viewer_cannot_preview()}
														</p>
														<a
															href={fileViewer.previewUrl}
															download={fileViewer.selectedFile?.name}
															class="text-primary hover:underline text-sm"
														>
															{m.document_viewer_download_button()}
														</a>
													</div>
												</object>
											</div>
										{:else}
											<div
												class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"
											>
												<FileWarning class="h-12 w-12" strokeWidth={1.25} />
												<p class="text-sm">
													{m.document_viewer_cannot_preview()}
												</p>
												<p class="text-xs text-muted-foreground/70">
													{fileViewer.selectedFile?.name}
												</p>
											</div>
										{/if}
									</div>
								</div>
							{:else}
								<div
									class="flex h-full items-center justify-center text-muted-foreground text-sm"
								>
									{m.empty_html_preview_title()}
								</div>
							{/if}
						{:else if activeTab === TAB_TERMINAL && isAgentMode}
							{#if codeAgentState.isDeleted}
								<SessionDeleted />
							{:else if currentSandboxId}
								<Terminal
									sandboxId={currentSandboxId}
									sessionId={currentSessionId}
								/>
							{:else}
								<div
									class="flex h-full items-center justify-center text-muted-foreground text-sm"
								>
									Sandbox not available
								</div>
							{/if}
						{:else if activeTab === TAB_TASKBOARD && isAgentMode}
							<!-- Taskboard Tab Content -->
							<TaskboardPanel />
						{:else if activeTab === TAB_SKILLS && (isAgentMode || isSkillsOnlyMode || !currentSandboxId)}
							<!-- Skills Tab Content -->
							<div class="flex h-full flex-col min-h-0 overflow-hidden">
								<!-- Skills Panel Header -->
								<SkillsPanelHeader
									currentView={skillsPanelState.currentView}
									viewStack={skillsPanelState.viewStack}
									canGoBack={skillsPanelState.canGoBack}
									isPinned={false}
									showPinButton={false}
									showCloseButton={false}
									onBack={() => skillsPanelState.pop()}
									onClose={() => {}}
									onTogglePin={() => {}}
									skillName={skillsPanelState.currentView.type === "detail" ||
									skillsPanelState.currentView.type === "edit"
										? skillsPanelState.currentView.skillName
										: ""}
								/>

								<!-- Skills Content Area -->
								<div class="flex-1 overflow-y-auto min-h-0">
									{#if skillsPanelState.currentView.type === "list"}
										<SkillsListView
											userSkills={skillsData.user_skills}
											builtinSkills={skillsData.builtin_skills}
											loading={codeAgentState.isLoadingSkills}
											onRefresh={loadSkills}
											onFavoriteChange={updateSkillFavoriteState}
										/>
									{:else if skillsPanelState.currentView.type === "detail"}
										<SkillDetailView
											skillName={skillsPanelState.currentView.skillName}
											skill={findSkill(
												skillsPanelState.currentView.skillName,
											)}
										/>
									{:else if skillsPanelState.currentView.type === "preview"}
										<SkillPreviewView
											skillName={skillsPanelState.currentView.skillName}
											skill={findSkill(
												skillsPanelState.currentView.skillName,
											)}
										/>
									{:else if skillsPanelState.currentView.type === "edit"}
										<SkillEditView
											skillName={skillsPanelState.currentView.skillName}
											skill={findSkill(
												skillsPanelState.currentView.skillName,
											)}
											onRefresh={loadSkills}
										/>
									{:else if skillsPanelState.currentView.type === "create-select"}
										<SkillCreateSelectView />
									{:else if skillsPanelState.currentView.type === "create-manual"}
										<SkillCreateManualView onRefresh={loadSkills} />
									{:else if skillsPanelState.currentView.type === "create-upload"}
										<SkillCreateUploadView onRefresh={loadSkills} />
									{:else if skillsPanelState.currentView.type === "create-github"}
										<SkillCreateGithubView onRefresh={loadSkills} />
									{:else if skillsPanelState.currentView.type === "create-history"}
										<SkillCreateHistoryView />
									{/if}
								</div>
							</div>
						{:else if activeTab === TAB_OPENCLAW_WEBUI && codeAgentState.currentAgentId === "open-claw"}
							<div class="flex h-full flex-col min-h-0 overflow-hidden">
								<OpenClawWebUI />
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
