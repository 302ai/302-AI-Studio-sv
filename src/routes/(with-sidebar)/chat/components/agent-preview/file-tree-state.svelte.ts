import {
	copySandboxFile,
	createSandboxFolder,
	deleteSandboxFile,
	downloadSandboxFile,
	listSandboxFiles,
	renameSandboxFile,
	uploadSandboxFile,
	type SandboxFileInfo,
} from "$lib/api/sandbox-file";
import { m } from "$lib/paraglide/messages";
import {
	agentPreviewState,
	type AgentPreviewSyncEnvelope,
} from "$lib/stores/agent-preview-state.svelte";
import { chatState } from "$lib/stores/chat-state.svelte";
import { codeAgentState } from "$lib/stores/code-agent";
import { persistedProviderState } from "$lib/stores/provider-state.svelte";
import { getSandboxDownloadErrorMessage } from "$lib/utils/sandbox-download-error";
import { createLogger } from "@shared/logger";
import { toast } from "svelte-sonner";
import { SvelteDate, SvelteMap, SvelteSet } from "svelte/reactivity";
import { DEFAULT_WORKSPACE_PATH } from "./constants";
import { handleError, validatePath, validateSandboxId } from "./utils";

const logger = createLogger("ui");

export interface TreeNode extends SandboxFileInfo {
	children: TreeNode[];
	depth: number;
	isExpanded?: boolean;
	isParentEntry?: boolean;
}

interface TreeCache {
	files: SandboxFileInfo[];
	nodes: TreeNode[];
}

/**
 * Path utility functions
 */
const pathUtils = {
	getParentDir: (path: string): string => {
		const lastSlashIndex = path.lastIndexOf("/");
		// If path is "/something" (only one slash at start), parent is "/"
		if (lastSlashIndex <= 0) {
			return "/";
		}
		return path.substring(0, lastSlashIndex);
	},
	getFileName: (path: string): string => path.split("/").pop() || "file",
	join: (...parts: string[]): string => parts.filter(Boolean).join("/"),
	normalize: (path: string): string => (path.startsWith("/") ? path : `/${path}`),
};

/**
 * Check if the given path is at the system root level
 * @param path - The current directory path
 * @returns true if path is "/" or empty (system root)
 */
export function isAtSystemRoot(path: string): boolean {
	const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;
	return normalizedPath === "" || normalizedPath === "/";
}

/**
 * Create a parent directory entry node ("..")
 * @returns TreeNode representing the parent directory entry
 */
export function createParentEntry(): TreeNode {
	return {
		name: "..",
		path: "..",
		type: "dir",
		children: [],
		depth: 0,
		isParentEntry: true,
	};
}

/**
 * Set utility functions for SvelteSet
 */
function addToSet<T>(set: SvelteSet<T>, item: T): SvelteSet<T> {
	const newSet = new SvelteSet(set);
	newSet.add(item);
	return newSet;
}

function removeFromSet<T>(set: SvelteSet<T>, item: T): SvelteSet<T> {
	const newSet = new SvelteSet(set);
	newSet.delete(item);
	return newSet;
}

export class FileTreeState {
	// State properties
	sandboxId = $state<string>("");
	workspacePath = $state<string>(DEFAULT_WORKSPACE_PATH);
	currentDirectory = $state<string>(DEFAULT_WORKSPACE_PATH);
	files = $state<SandboxFileInfo[]>([]);
	treeNodes = $state<TreeNode[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	selectedFile = $state<string | null>(null);
	loadedDirs = $state(new SvelteSet<string>());
	loadingDirs = $state(new SvelteSet<string>());
	downloadingPaths = $state(new SvelteSet<string>());
	operatingPaths = $state(new SvelteSet<string>());
	copiedFilePath = $state<string | null>(null);
	treeNodesCache = $state<TreeCache | null>(null);
	syncUnsubscribe: (() => void) | null = null;

	// Derived state
	isStreaming = $derived(chatState.isStreaming || chatState.isSubmitted);

	// Computed root path - uses workspacePath if set, otherwise falls back to DEFAULT_WORKSPACE_PATH
	get rootPath(): string {
		return this.workspacePath || DEFAULT_WORKSPACE_PATH;
	}

	// Check if parent directory is currently loading (for ".." loading indicator)
	get isParentLoading(): boolean {
		const parentPath = pathUtils.getParentDir(this.currentDirectory);
		return this.loadingDirs.has(parentPath);
	}

	constructor(sandboxId: string, workspacePath?: string) {
		this.sandboxId = sandboxId;
		if (workspacePath) {
			this.workspacePath = workspacePath;
			this.currentDirectory = workspacePath;
		}
	}

	updateSandboxId(sandboxId: string) {
		this.sandboxId = sandboxId;
	}

	updateWorkspacePath(workspacePath: string) {
		if (workspacePath && workspacePath !== this.workspacePath) {
			this.workspacePath = workspacePath;
			this.currentDirectory = workspacePath;
		}
	}

	setupSyncListener(sessionId: string | null | undefined) {
		if (!this.sandboxId || !sessionId) {
			return;
		}

		if (this.syncUnsubscribe) {
			this.syncUnsubscribe();
		}

		this.syncUnsubscribe = agentPreviewState.onSync((message: AgentPreviewSyncEnvelope) => {
			if (
				message.sandboxId !== this.sandboxId ||
				message.sessionId !== sessionId ||
				message.sourceInstanceId === agentPreviewState.syncIdentifier
			) {
				return;
			}

			if (message.type === "fileListUpdated") {
				this.files = message.fileList;
				this.selectedFile = message.selectedFilePath ?? this.selectedFile;
				this.loadedDirs = this.inferLoadedDirsFromFiles(this.files);
				this.treeNodesCache = null;
				this.rebuildTree();
			}
		});
	}

	disposeSyncListener() {
		if (this.syncUnsubscribe) {
			this.syncUnsubscribe();
			this.syncUnsubscribe = null;
		}
	}

	/**
	 * Get 302.AI provider API key
	 */
	private get302ApiKey(): string {
		const provider = persistedProviderState.current.find(
			(p) => p.name === "302.AI" && p.enabled,
		);
		const key = provider?.apiKey || "";
		return key;
	}

	/**
	 * Get user-friendly error message from error object
	 * Translates common browser error messages to localized versions
	 */
	private getErrorMessage(error: unknown): string {
		if (!(error instanceof Error)) {
			return m.toast_file_operation_load_failed();
		}
		// Handle common browser network errors
		if (error.message === "Failed to fetch") {
			return m.toast_file_operation_network_error();
		}
		return error.message;
	}

	/**
	 * Build tree structure with flat directory view
	 * Shows only direct children of currentDirectory with depth 0 and empty children arrays
	 * Prepends ".." parent entry when not at root
	 */
	buildTreeStructure(fileList: SandboxFileInfo[]): TreeNode[] {
		// Filter files to only include direct children of currentDirectory
		// Special case: "/" should stay as "/" not become ""
		let normalizedCurrentDir = this.currentDirectory.endsWith("/")
			? this.currentDirectory.slice(0, -1)
			: this.currentDirectory;
		if (normalizedCurrentDir === "") {
			normalizedCurrentDir = "/";
		}

		const directChildren = fileList.filter((file) => {
			const parentDir = pathUtils.getParentDir(file.path);
			return parentDir === normalizedCurrentDir;
		});

		// Sort alphabetically, folders first
		const sortedChildren = [...directChildren].sort((a, b) => {
			// Folders come before files
			if (a.type === "dir" && b.type !== "dir") return -1;
			if (a.type !== "dir" && b.type === "dir") return 1;
			// Then sort alphabetically by name
			return a.name.localeCompare(b.name);
		});

		// Create flat tree nodes with depth 0 and empty children
		const flatNodes: TreeNode[] = sortedChildren.map((file) => ({
			...file,
			children: [], // Always empty in flat view
			depth: 0, // Always 0 in flat view
			isExpanded: false, // Not used in flat view
		}));

		// Prepend parent entry (".." ) when not at system root
		if (!isAtSystemRoot(this.currentDirectory)) {
			flatNodes.unshift(createParentEntry());
		}

		// Update cache
		this.treeNodesCache = {
			files: [...fileList],
			nodes: flatNodes,
		};

		return flatNodes;
	}

	/**
	 * Rebuild tree structure (invalidates cache and rebuilds)
	 */
	rebuildTree(): void {
		this.treeNodesCache = null;
		this.treeNodes = this.buildTreeStructure(this.files);
	}

	/**
	 * Infer loaded directories from file list
	 */
	private inferLoadedDirsFromFiles(fileList: SandboxFileInfo[]): SvelteSet<string> {
		const dirs = new SvelteSet<string>();
		for (const file of fileList) {
			const parentDir = pathUtils.getParentDir(file.path);
			if (parentDir) {
				dirs.add(parentDir);
			}
		}
		return dirs;
	}

	/**
	 * Check if directory has direct children
	 */
	hasDirectChildren(dirPath: string): boolean {
		const normalizedDir = pathUtils.normalize(dirPath);
		const normalizedDirPath = normalizedDir.endsWith("/")
			? normalizedDir.slice(0, -1)
			: normalizedDir;

		return this.files.some((file) => {
			const fileDir = pathUtils.getParentDir(file.path);
			return fileDir === normalizedDirPath;
		});
	}

	/**
	 * Save file list to storage, preserving existing data
	 */
	private async saveToStorage(
		updates?: Partial<{ selectedFilePath: string | null }>,
		shouldBroadcast: boolean = false,
	): Promise<void> {
		const sessionId = codeAgentState.currentSessionId;
		if (!sessionId) {
			return;
		}

		const existingStorage = await agentPreviewState.loadFromStorage(this.sandboxId, sessionId);
		await agentPreviewState.saveToStorage(this.sandboxId, sessionId, {
			fileList: this.files,
			fileContents: existingStorage?.fileContents || {},
			deployedUrl: existingStorage?.deployedUrl,
			deploymentId: existingStorage?.deploymentId,
			deployedAt: existingStorage?.deployedAt,
			selectedFilePath:
				updates?.selectedFilePath ?? this.selectedFile ?? existingStorage?.selectedFilePath,
			fileTreeCurrentDirectory: this.currentDirectory,
			currentWorkingDirectory: existingStorage?.currentWorkingDirectory,
			terminalHistory: existingStorage?.terminalHistory,
			type: existingStorage?.type,
			lastUpdated: new SvelteDate().toISOString(),
		});

		if (shouldBroadcast) {
			agentPreviewState.broadcastFileListSync({
				sandboxId: this.sandboxId,
				sessionId,
				fileList: this.files,
				selectedFilePath: updates?.selectedFilePath ?? this.selectedFile,
				fileTreeCurrentDirectory: this.currentDirectory,
			});
		}
	}

	/**
	 * Load file list from storage
	 */
	async loadFromStorage(clearIfNotFound: boolean = false): Promise<void> {
		if (!this.sandboxId) {
			return;
		}

		const sessionId = codeAgentState.currentSessionId;
		if (!sessionId) {
			return;
		}

		try {
			const storage = await agentPreviewState.loadFromStorage(this.sandboxId, sessionId);
			if (storage && storage.fileList.length > 0) {
				this.files = storage.fileList;
				// Restore currentDirectory from storage, fallback to workspacePath
				if (storage.fileTreeCurrentDirectory) {
					this.currentDirectory = storage.fileTreeCurrentDirectory;
				}
				this.treeNodes = this.buildTreeStructure(this.files);
				this.loadedDirs = this.inferLoadedDirsFromFiles(this.files);
			} else if (clearIfNotFound) {
				this.files = [];
				this.treeNodes = [];
				this.loadedDirs = new SvelteSet();
			} else {
				logger.info("No data in storage, keeping existing files");
			}
		} catch (e) {
			logger.error("Failed to load from storage:", e);
			if (clearIfNotFound) {
				this.files = [];
				this.treeNodes = [];
				this.loadedDirs = new SvelteSet();
			}
		}
	}

	/**
	 * Load files from API
	 */
	/**
	 * Load files from API
	 */
	async loadFiles(
		path: string = DEFAULT_WORKSPACE_PATH,
		merge: boolean = false,
		force: boolean = false,
	): Promise<void> {
		logger.info("loadFiles", { path, merge, force, isStreaming: this.isStreaming });

		if (!this.sandboxId) {
			return;
		}

		if (!validateSandboxId(this.sandboxId)) {
			handleError(new Error(m.toast_file_operation_invalid_sandbox_id()), "Load files");
			return;
		}

		if (!validatePath(path)) {
			handleError(new Error(m.toast_file_operation_invalid_path()), "Load files");
			return;
		}

		// Do not load files while agent is streaming, unless forced (e.g. user initiated navigation)
		if (this.isStreaming && !force) {
			logger.info("loadFiles skipped due to streaming");
			return;
		}

		// Skip if already loaded (for lazy loading), unless forced
		if (!force && merge && this.loadedDirs.has(path)) {
			return;
		}

		// Skip if currently loading
		if (this.loadingDirs.has(path)) {
			return;
		}

		this.loadingDirs = addToSet(this.loadingDirs, path);

		// If we are forcing a refresh or not merging (initial load), show loading state
		if (!merge || force) {
			this.loading = true;
		}
		this.error = null;

		try {
			const apiKey = this.get302ApiKey();
			if (!apiKey) {
				this.error = m.toast_file_operation_api_key_not_found();
				handleError(new Error(this.error), "Load files");
				return;
			}

			const response = await listSandboxFiles(this.sandboxId, path, 2);

			if (response.success && response.filelist) {
				if (merge) {
					// Merge new files into existing files array
					// 1. Update existing files if they are in the new list
					// 2. Add new files that are not in the existing list
					const newFilesMap = new SvelteMap(response.filelist.map((f) => [f.path, f]));
					const existingPaths = new SvelteSet(this.files.map((f) => f.path));

					// Update existing files
					const updatedFiles = this.files.map((f) => {
						if (newFilesMap.has(f.path)) {
							return newFilesMap.get(f.path)!;
						}
						return f;
					});

					// Add new files
					const newFiles = response.filelist.filter((f) => !existingPaths.has(f.path));
					this.files = [...updatedFiles, ...newFiles];
				} else {
					// Replace all files (initial load or refresh)
					this.files = response.filelist;
				}

				// Mark directory as loaded
				this.loadedDirs = addToSet(this.loadedDirs, path);

				// Rebuild tree
				this.rebuildTree();

				// Save to storage
				await this.saveToStorage(undefined, true);
			} else {
				if (!merge) {
					this.files = [];
					this.treeNodes = [];
				}
			}
		} catch (e) {
			this.error = this.getErrorMessage(e);
			handleError(e, "Load sandbox files", false);
			if (!merge) {
				this.files = [];
				this.treeNodes = [];
				this.treeNodesCache = null;
			}

			// Recovery: if current directory was deleted, navigate to parent or root
			// Detect directory deletion by checking error message patterns
			const errorMsg = this.error || "";
			const isDirectoryNotFound =
				errorMsg.includes("path not found") ||
				errorMsg.includes("no such file or directory") ||
				errorMsg.includes("does not exist") ||
				errorMsg.includes("Failed to list files");

			if (isDirectoryNotFound && !isAtSystemRoot(this.currentDirectory)) {
				// Try to navigate to parent directory
				const parentPath = pathUtils.getParentDir(this.currentDirectory);
				logger.info(
					`[FileTree] Current directory deleted, navigating to parent: ${parentPath}`,
				);

				// Update currentDirectory and try loading parent
				this.currentDirectory = parentPath;
				this.error = null; // Clear error before retry

				try {
					await this.loadFiles(parentPath, false, true);
				} catch (_retryError) {
					// If parent also fails, fallback to workspace root
					if (!isAtSystemRoot(parentPath)) {
						logger.info(
							"Parent directory also invalid, falling back to workspace root",
						);
						this.currentDirectory = this.rootPath;
						this.error = null;
						await this.loadFiles(this.rootPath, false, true);
					}
				}
			} else if (isDirectoryNotFound && isAtSystemRoot(this.currentDirectory)) {
				// At system root and directory not found - reset to workspace path
				logger.info("At system root with error, resetting to workspace path");
				this.currentDirectory = this.rootPath;
				this.error = null;
				await this.saveToStorage(); // Update storage with valid path
			}
		} finally {
			this.loadingDirs = removeFromSet(this.loadingDirs, path);
			if (!merge || force) {
				this.loading = false;
			}
		}
	}

	/**
	 * Refresh file tree (reload current directory)
	 */
	async refreshFileTree(): Promise<void> {
		this.loadedDirs = new SvelteSet();
		this.treeNodesCache = null;
		await this.loadFiles(this.currentDirectory, false, true);
	}

	/**
	 * Navigate to a folder (folder navigation model)
	 * Sets currentDirectory to the target folder and loads its contents
	 */
	async navigateToFolder(folderPath: string): Promise<void> {
		logger.info("navigateToFolder", folderPath);
		if (!folderPath) {
			return;
		}

		// Set current directory BEFORE loading to ensure any broadcasts include the new context
		this.currentDirectory = folderPath;

		// Load folder contents first (always force refresh to ensure sync with server)
		// merge=false: replace existing files to ensure deleted files are removed
		// force=true: force API call even if locally cached
		try {
			await this.loadFiles(folderPath, false, true);
		} catch (error) {
			logger.error("Failed to load folder:", error);
			// If load fails, we might want to revert currentDirectory or handle error
			// The loadFiles method already has recovery logic which updates currentDirectory if needed
		}

		// Rebuild tree to show the new directory contents
		this.rebuildTree();

		// Persist currentDirectory to storage for session continuity
		// Note: loadFiles already calls saveToStorage if successful, but we call it here again
		// to ensure consistency even if loadFiles partial logic ran or we need to ensure local state save
		await this.saveToStorage();
	}

	/**
	 * Navigate to parent directory
	 * Computes parent path and navigates to it, guarding against system root boundary
	 */
	async navigateToParent(): Promise<void> {
		logger.info("navigateToParent");
		// Guard against navigating above system root
		if (this.currentDirectory === "/" || this.currentDirectory === "") {
			return;
		}

		// Compute parent path
		const parentPath = pathUtils.getParentDir(this.currentDirectory);

		// Guard against empty parent path (shouldn't happen, but safety check)
		if (!parentPath) {
			return;
		}

		// Navigate to parent folder
		await this.navigateToFolder(parentPath);
	}

	/**
	 * Validate operation prerequisites
	 */
	private validateOperation(path: string): { valid: boolean; apiKey: string | null } {
		if (!this.sandboxId) {
			toast.error(m.toast_file_operation_sandbox_id_not_available());
			return { valid: false, apiKey: null };
		}

		if (this.isStreaming) {
			toast.error(m.toast_file_operation_streaming());
			return { valid: false, apiKey: null };
		}

		if (this.operatingPaths.has(path)) {
			return { valid: false, apiKey: null };
		}

		const apiKey = this.get302ApiKey();
		if (!apiKey) {
			toast.error(m.toast_file_operation_api_key_not_found());
			return { valid: false, apiKey: null };
		}

		return { valid: true, apiKey };
	}

	/**
	 * Update files and rebuild tree
	 */
	private async updateFilesAndRebuild(
		newFiles: SandboxFileInfo[],
		selectedPathUpdate?: string | null,
	): Promise<void> {
		this.files = newFiles;
		if (selectedPathUpdate !== undefined) {
			this.selectedFile = selectedPathUpdate;
		}
		await this.saveToStorage({ selectedFilePath: this.selectedFile }, true);
		this.rebuildTree();
	}

	/**
	 * Rename file
	 */
	async renameFile(oldPath: string, newPath: string, newName: string): Promise<boolean> {
		const validation = this.validateOperation(oldPath);
		if (!validation.valid || !validation.apiKey) {
			return false;
		}

		this.operatingPaths = addToSet(this.operatingPaths, oldPath);
		const toastId = toast.loading(m.toast_file_renaming());

		try {
			const response = await renameSandboxFile(this.sandboxId, oldPath, newPath);

			if (response.success) {
				toast.success(m.toast_file_rename_success(), { id: toastId });

				// Update file in list
				const fileIndex = this.files.findIndex((f) => f.path === oldPath);
				if (fileIndex !== -1) {
					this.files[fileIndex] = {
						...this.files[fileIndex],
						path: newPath,
						name: newName,
					};

					// Update selected file if it was renamed
					if (this.selectedFile === oldPath) {
						this.selectedFile = newPath;
					}

					await this.updateFilesAndRebuild(this.files, this.selectedFile);
				}
				return true;
			} else {
				const errorMsg = response.error || m.toast_file_rename_failed();
				toast.error(errorMsg, { id: toastId });
				return false;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_rename_failed();
			toast.error(errorMsg, { id: toastId });
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, oldPath);
		}
	}

	/**
	 * Rename folder
	 * - Local mode: uses Electron IPC to rename on local filesystem
	 * - Remote mode: uses HTTP sandbox API
	 */
	async renameFolder(oldPath: string, newPath: string, newName: string): Promise<boolean> {
		if (!this.sandboxId) {
			toast.error(m.toast_file_operation_sandbox_id_not_available());
			return false;
		}

		if (this.isStreaming) {
			toast.error(m.toast_file_operation_streaming());
			return false;
		}

		if (this.operatingPaths.has(oldPath)) {
			return false;
		}

		this.operatingPaths = addToSet(this.operatingPaths, oldPath);
		const toastId = toast.loading(m.toast_file_renaming());

		try {
			if (codeAgentState.type === "local") {
				// Local mode: IPC → rename on local filesystem directly
				const stripWorkspace = (p: string) => {
					const rel = p.startsWith(DEFAULT_WORKSPACE_PATH)
						? p.slice(DEFAULT_WORKSPACE_PATH.length)
						: p;
					return rel.startsWith("/") ? rel.slice(1) : rel;
				};
				const result = await window.electronAPI.codeAgentService.renameWorkspaceDirectory(
					stripWorkspace(oldPath),
					stripWorkspace(newPath),
				);
				if (!result.success) {
					toast.error(result.error || m.toast_file_rename_folder_failed(), {
						id: toastId,
					});
					return false;
				}
			} else {
				// Remote mode: HTTP sandbox API
				const apiKey = this.get302ApiKey();
				if (!apiKey) {
					toast.error(m.toast_file_operation_api_key_not_found(), { id: toastId });
					return false;
				}
				const response = await renameSandboxFile(this.sandboxId, oldPath, newPath);
				if (!response.success) {
					toast.error(response.error || m.toast_file_rename_folder_failed(), {
						id: toastId,
					});
					return false;
				}
			}

			toast.success(m.toast_file_rename_folder_success(), { id: toastId });

			// Update the folder and all its children paths in the local file list
			const newFiles = this.files.map((f) => {
				if (f.path === oldPath) return { ...f, path: newPath, name: newName };
				if (f.path.startsWith(`${oldPath}/`))
					return { ...f, path: f.path.replace(oldPath, newPath) };
				return f;
			});

			// Update selected file path if it was inside the renamed folder
			const newSelected = this.selectedFile?.startsWith(`${oldPath}/`)
				? this.selectedFile.replace(oldPath, newPath)
				: this.selectedFile;

			await this.updateFilesAndRebuild(newFiles, newSelected);
			return true;
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_rename_folder_failed();
			toast.error(errorMsg, { id: toastId });
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, oldPath);
		}
	}

	/**
	 * Delete file or folder
	 */
	async deleteFile(path: string): Promise<boolean> {
		const validation = this.validateOperation(path);
		if (!validation.valid || !validation.apiKey) {
			return false;
		}

		this.operatingPaths = addToSet(this.operatingPaths, path);
		const toastId = toast.loading(m.toast_file_deleting());

		try {
			const response = await deleteSandboxFile(this.sandboxId, path);

			if (response.success) {
				toast.success(m.toast_file_delete_success(), { id: toastId });

				// Remove deleted file/folder and all children
				const newFiles = this.files.filter((f) => {
					if (f.path === path) {
						return false;
					}
					if (path.endsWith("/")) {
						return !f.path.startsWith(path);
					}
					return !f.path.startsWith(`${path}/`);
				});

				// Clear selected file if it was deleted
				const selectedPathUpdate =
					this.selectedFile === path || this.selectedFile?.startsWith(`${path}/`)
						? null
						: this.selectedFile;

				await this.updateFilesAndRebuild(newFiles, selectedPathUpdate);
				return true;
			} else {
				const errorMsg = response.error || m.toast_file_delete_failed();
				toast.error(errorMsg, { id: toastId });
				return false;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_delete_failed();
			toast.error(errorMsg, { id: toastId });
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, path);
		}
	}

	/**
	 * Copy file path
	 */
	copyFile(path: string): void {
		this.copiedFilePath = path;
		toast.success(m.toast_copied_success());
	}

	/**
	 * Generate a unique file/folder name to avoid duplicates
	 * @param targetDirPath - The target directory path
	 * @param originalName - The original file/folder name
	 * @returns A unique name (possibly with suffix like "_1", "_2")
	 */
	private generateUniqueName(targetDirPath: string, originalName: string): string {
		// Normalize target directory path
		const normalizedDir = targetDirPath.endsWith("/")
			? targetDirPath.slice(0, -1)
			: targetDirPath;

		// Get all existing names in target directory
		const existingNames = new SvelteSet(
			this.files
				.filter((f) => pathUtils.getParentDir(f.path) === normalizedDir)
				.map((f) => f.name),
		);

		// If no conflict, return original name
		if (!existingNames.has(originalName)) {
			return originalName;
		}

		// Split name and extension for files
		const lastDotIndex = originalName.lastIndexOf(".");
		const hasExtension = lastDotIndex > 0; // Ensure dot is not at start (hidden files)
		const baseName = hasExtension ? originalName.slice(0, lastDotIndex) : originalName;
		const extension = hasExtension ? originalName.slice(lastDotIndex) : "";

		// Find a unique name with suffix (use underscore to avoid shell escaping issues)
		let counter = 1;
		let newName = `${baseName}_${counter}${extension}`;

		while (existingNames.has(newName)) {
			counter++;
			newName = `${baseName}_${counter}${extension}`;
		}

		return newName;
	}

	/**
	 * Paste file or folder
	 */
	async pasteFile(sourcePath: string, targetDir: SandboxFileInfo): Promise<boolean> {
		if (!this.sandboxId || !sourcePath) {
			return false;
		}

		if (targetDir.type !== "dir") {
			toast.error(m.toast_file_paste_target_not_dir());
			return false;
		}

		const validation = this.validateOperation(sourcePath);
		if (!validation.valid || !validation.apiKey) {
			return false;
		}

		this.operatingPaths = addToSet(this.operatingPaths, sourcePath);

		// Build destination path with unique name to avoid duplicates
		const sourceName = pathUtils.getFileName(sourcePath);
		const uniqueName = this.generateUniqueName(targetDir.path, sourceName);
		const destPath = `${targetDir.path}/${uniqueName}`;

		const toastId = toast.loading(m.toast_file_pasting());

		try {
			const response = await copySandboxFile(this.sandboxId, sourcePath, destPath);

			if (response.success) {
				toast.success(m.toast_file_paste_success(), { id: toastId });

				// Use the same refresh flow as the UI refresh button to keep tree state consistent
				await this.refreshFileTree();
				return true;
			} else {
				const errorMsg = response.error || m.toast_file_paste_failed();
				toast.error(errorMsg, { id: toastId });
				return false;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_paste_failed();
			toast.error(errorMsg, { id: toastId });
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, sourcePath);
		}
	}

	/**
	 * Create a new file
	 */
	async createFile(
		filename: string,
		parentPath: string = DEFAULT_WORKSPACE_PATH,
	): Promise<SandboxFileInfo | null> {
		if (!this.sandboxId) {
			toast.error(m.toast_file_operation_sandbox_id_not_available());
			return null;
		}

		const apiKey = this.get302ApiKey();
		if (!apiKey) {
			toast.error(m.toast_file_operation_api_key_not_found());
			return null;
		}

		// Validate filename (duplicates check is handled by backend usually, but we can check local list too)
		const fullPath = parentPath.endsWith("/")
			? `${parentPath}${filename}`
			: `${parentPath}/${filename}`;

		if (this.files.some((f) => f.path === fullPath)) {
			toast.error(m.toast_file_create_failed() + ": File already exists");
			return null;
		}

		this.operatingPaths = addToSet(this.operatingPaths, parentPath);
		const toastId = toast.loading(m.toast_file_creating());

		try {
			// Create an empty file
			const file = new File([""], filename, { type: "text/plain" });

			const response = await uploadSandboxFile(this.sandboxId, fullPath, file);

			if (response.success) {
				toast.success(m.toast_file_create_success(), { id: toastId });

				// Create new file info object
				const newFile: SandboxFileInfo = {
					name: filename,
					path: fullPath,
					type: "file",
					size: 0,
					modified_time: new SvelteDate().toISOString(), // Approximate
				};

				// Update file list
				this.files = [...this.files, newFile];

				// Ensure parent directory is marked as loaded so we don't overwrite with a fetch
				if (parentPath !== DEFAULT_WORKSPACE_PATH) {
					this.loadedDirs = addToSet(this.loadedDirs, parentPath);
				}

				// Update files and set the new file as selected
				// This ensures the selectedFilePath in storage is updated before broadcasting
				await this.updateFilesAndRebuild(this.files, newFile.path);
				return newFile;
			} else {
				const errorMsg = response.error || m.toast_file_create_failed();
				toast.error(errorMsg, { id: toastId });
				return null;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_create_failed();
			toast.error(errorMsg, { id: toastId });
			return null;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, parentPath);
		}
	}

	/**
	 * Upload file
	 */
	async uploadFile(file: File, targetPath: string = DEFAULT_WORKSPACE_PATH): Promise<boolean> {
		if (!this.sandboxId) {
			toast.error(m.toast_file_operation_sandbox_id_not_available());
			return false;
		}

		// API key check is only needed for cloud mode
		if (codeAgentState.type !== "local") {
			const apiKey = this.get302ApiKey();
			if (!apiKey) {
				toast.error(m.toast_file_operation_api_key_not_found());
				return false;
			}
		}

		this.operatingPaths = addToSet(this.operatingPaths, targetPath);
		const toastId = toast.loading(m.toast_file_uploading());

		try {
			// Construct full path including filename
			// The API expects the full path of the file, not just the directory
			const fullPath = targetPath.endsWith("/")
				? `${targetPath}${file.name}`
				: `${targetPath}/${file.name}`;

			const response = await uploadSandboxFile(this.sandboxId, fullPath, file);

			if (response.success) {
				toast.success(m.toast_file_upload_success(), { id: toastId });

				// Refresh the target directory to show the new file
				// If targetPath is the root or a loaded directory, we need to refresh it
				if (targetPath === this.rootPath || this.loadedDirs.has(targetPath)) {
					// Add a small delay to ensure the server has processed the upload
					await new Promise((resolve) => setTimeout(resolve, 500));
					await this.loadFiles(targetPath, true, true); // Merge mode + Force update
				}

				return true;
			} else {
				const errorMsg = response.error || m.toast_file_upload_failed();
				toast.error(errorMsg, { id: toastId });
				return false;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_upload_failed();
			toast.error(errorMsg, { id: toastId });
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, targetPath);
		}
	}

	/**
	 * Upload folder (uses main process to zip, then uploads with auto_unzip)
	 */
	async uploadFolder(targetPath: string = DEFAULT_WORKSPACE_PATH): Promise<boolean> {
		if (!this.sandboxId) {
			toast.error(m.toast_file_operation_sandbox_id_not_available());
			return false;
		}

		// Local mode optimization: Direct copy without zip
		if (codeAgentState.type === "local") {
			const uploadToastId = toast.loading(m.toast_file_upload_selecting_folder());
			try {
				const result = await window.electronAPI.dataService.selectFolderForUpload();

				if (!result) {
					toast.dismiss(uploadToastId);
					return false;
				}

				const { folderPath, folderName } = result;
				toast.loading(m.toast_file_upload_uploading_folder(), { id: uploadToastId });

				// Construct full target path: targetPath/folderName
				const fullTargetPath = targetPath.endsWith("/")
					? `${targetPath}${folderName}`
					: `${targetPath}/${folderName}`;

				// Call localVibeService copy directly
				const copyResult = await window.electronAPI.localVibeService.copyToWorkspaceByIpc(
					folderPath,
					fullTargetPath,
				);

				if (copyResult.success) {
					toast.success(m.toast_file_upload_folder_success(), { id: uploadToastId });

					// Refresh the target directory
					if (targetPath === this.rootPath || this.loadedDirs.has(targetPath)) {
						await this.loadFiles(targetPath, true, true);
					}
					return true;
				} else {
					toast.error(copyResult.error || m.toast_file_upload_folder_failed(), {
						id: uploadToastId,
					});
					return false;
				}
			} catch (e) {
				const errorMsg =
					e instanceof Error ? e.message : m.toast_file_upload_folder_failed();
				toast.error(errorMsg, { id: uploadToastId });
				return false;
			}
		}

		const apiKey = this.get302ApiKey();
		if (!apiKey) {
			toast.error(m.toast_file_operation_api_key_not_found());
			return false;
		}

		this.operatingPaths = addToSet(this.operatingPaths, targetPath);
		const uploadToastId = toast.loading(m.toast_file_upload_selecting_folder());

		try {
			// Use IPC to let user select folder and create zip in main process
			const result = await window.electronAPI.dataService.zipFolderForUpload();

			if (!result) {
				// User cancelled
				toast.dismiss(uploadToastId);
				return false;
			}

			const { zipPath, folderName } = result;
			toast.loading(m.toast_file_upload_reading_zip(), { id: uploadToastId });

			// Read the zip file from the temp path using Electron IPC
			const fileResponse = await fetch(`file://${zipPath}`);
			const zipBlob = await fileResponse.blob();
			const zipFile = new File([zipBlob], `${folderName}.zip`, { type: "application/zip" });

			toast.loading(m.toast_file_upload_uploading_folder(), { id: uploadToastId });

			// Construct path for the zip file
			const zipUploadPath = targetPath.endsWith("/")
				? `${targetPath}${zipFile.name}`
				: `${targetPath}/${zipFile.name}`;

			const response = await uploadSandboxFile(
				this.sandboxId,
				zipUploadPath,
				zipFile,
				true, // auto_unzip
			);

			if (response.success) {
				toast.success(m.toast_file_upload_folder_success(), { id: uploadToastId });

				// Refresh the target directory
				if (targetPath === this.rootPath || this.loadedDirs.has(targetPath)) {
					await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for unzip
					await this.loadFiles(targetPath, true, true);
				}

				return true;
			} else {
				const errorMsg = response.error || m.toast_file_upload_folder_failed();
				toast.error(errorMsg, { id: uploadToastId });
				return false;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_upload_folder_failed();
			toast.error(errorMsg, { id: uploadToastId });
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, targetPath);
		}
	}

	/**
	 * Create new folder
	 */
	async createFolder(parentPath: string, folderName: string): Promise<boolean> {
		if (!this.sandboxId) {
			toast.error(m.toast_file_operation_sandbox_id_not_available());
			return false;
		}

		const apiKey = this.get302ApiKey();
		if (!apiKey) {
			toast.error(m.toast_file_operation_api_key_not_found());
			return false;
		}

		const targetPath = parentPath.endsWith("/")
			? `${parentPath}${folderName}`
			: `${parentPath}/${folderName}`;

		this.operatingPaths = addToSet(this.operatingPaths, parentPath);
		const toastId = toast.loading(m.toast_file_creating_folder());

		try {
			const response = await createSandboxFolder(this.sandboxId, targetPath);

			if (response.success) {
				toast.success(m.toast_file_create_folder_success(), { id: toastId });

				// Refresh the parent directory
				if (parentPath === this.rootPath || this.loadedDirs.has(parentPath)) {
					await new Promise((resolve) => setTimeout(resolve, 500));
					await this.loadFiles(parentPath, true, true);
				}

				return true;
			} else {
				const errorMsg = response.error || m.toast_file_create_folder_failed();
				toast.error(errorMsg, { id: toastId });
				return false;
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : m.toast_file_create_folder_failed();
			toast.error(errorMsg, { id: toastId });
			return false;
		} finally {
			this.operatingPaths = removeFromSet(this.operatingPaths, parentPath);
		}
	}

	/**
	 * Download file or folder
	 */
	async downloadFile(file: SandboxFileInfo): Promise<void> {
		if (!this.sandboxId) {
			toast.error(m.toast_download_sandbox_id_not_available());
			return;
		}

		const apiKey = this.get302ApiKey();
		if (!apiKey) {
			toast.error(m.toast_download_api_key_not_found());
			return;
		}

		// Prevent duplicate downloads
		if (this.downloadingPaths.has(file.path)) {
			return;
		}

		this.downloadingPaths = addToSet(this.downloadingPaths, file.path);

		const fileName = file.name || pathUtils.getFileName(file.path);
		const downloadToastId = toast.loading(m.toast_downloading_file({ fileName }));

		try {
			const response = await downloadSandboxFile(this.sandboxId, file.path);

			if (!response.result || response.result.length === 0) {
				toast.error(m.toast_download_no_info(), { id: downloadToastId });
				return;
			}

			toast.loading(m.toast_downloading_file({ fileName }), {
				id: downloadToastId,
			});

			// Process each result (file or folder)
			for (const result of response.result) {
				if (!result.file_list || result.file_list.length === 0) {
					continue;
				}

				if (result.path_type === "dir") {
					// Folder download: download files one by one
					await this.downloadFolder(result, file.path, downloadToastId);
				} else {
					// Single file download
					await this.downloadSingleFile(result, file, response, downloadToastId);
				}
			}
		} catch (e) {
			const errorMsg = getSandboxDownloadErrorMessage(e);
			toast.error(errorMsg, { id: downloadToastId });
		} finally {
			this.downloadingPaths = removeFromSet(this.downloadingPaths, file.path);
		}
	}

	/**
	 * Download folder (helper method)
	 */
	private async downloadFolder(
		result: { file_list: Array<{ upload_url?: string; sandbox_path: string }> },
		basePath: string,
		toastId: string | number,
	): Promise<void> {
		let successCount = 0;
		let failCount = 0;

		toast.loading(m.toast_downloading_folder(), {
			id: toastId,
		});

		for (let i = 0; i < result.file_list.length; i++) {
			const fileItem = result.file_list[i];
			if (!fileItem.upload_url || fileItem.upload_url.trim() === "") {
				failCount++;
				continue;
			}

			try {
				const fileResponse = await fetch(fileItem.upload_url);
				if (!fileResponse.ok) {
					failCount++;
					continue;
				}

				const relativePath = fileItem.sandbox_path.replace(basePath, "").replace(/^\//, "");
				const fileName = relativePath || pathUtils.getFileName(fileItem.sandbox_path);
				const blob = await fileResponse.blob();

				this.downloadBlob(blob, fileName);
				successCount++;

				toast.loading(m.toast_downloading_folder(), {
					id: toastId,
				});
			} catch (e) {
				logger.error("Failed to download folder:", e);
				failCount++;

				toast.loading(m.toast_downloading_folder(), {
					id: toastId,
				});
			}
		}

		// Show result
		if (successCount > 0) {
			const failedText =
				failCount > 0 ? m.toast_download_folder_success_failed({ failCount }) : "";
			toast.success(
				m.toast_download_folder_success({
					count: successCount,
					plural: successCount > 1 ? m.toast_download_folder_success_plural() : "",
					failedText,
				}),
				{ id: toastId },
			);
		} else {
			toast.error(
				m.toast_download_folder_failed({
					failCount,
					plural: failCount > 1 ? "s" : "",
				}),
				{ id: toastId },
			);
		}
	}

	/**
	 * Download single file (helper method)
	 */
	private async downloadSingleFile(
		result: {
			file_list: Array<{ upload_url?: string; sandbox_path: string }>;
		},
		file: SandboxFileInfo,
		response: {
			result: Array<{ file_list: Array<{ upload_url?: string; sandbox_path: string }> }>;
			_directContent?: string;
			_blobContent?: Blob;
			_contentType?: string;
		},
		toastId: string | number,
	): Promise<void> {
		const fileItem = result.file_list[0];

		try {
			let blob: Blob;
			let downloadFileName = file.name || pathUtils.getFileName(fileItem.sandbox_path);

			toast.loading(m.toast_downloading_file({ fileName: downloadFileName }), {
				id: toastId,
			});

			// Check for direct content or upload_url
			if (response._blobContent) {
				blob = response._blobContent;

				const isZip = response._contentType?.includes("application/zip");

				if ((file.type === "dir" || isZip) && !downloadFileName.endsWith(".zip")) {
					downloadFileName += ".zip";
				}
			} else if (
				(!fileItem.upload_url || fileItem.upload_url.trim() === "") &&
				response._directContent
			) {
				const contentType = response._contentType || "text/plain";
				blob = new Blob([response._directContent], { type: contentType });
			} else if (fileItem.upload_url && fileItem.upload_url.trim() !== "") {
				toast.loading(m.toast_downloading_file({ fileName: downloadFileName }), {
					id: toastId,
				});
				const fileResponse = await fetch(fileItem.upload_url);
				if (!fileResponse.ok) {
					throw new Error(
						m.toast_download_file_failed({ error: fileResponse.statusText }),
					);
				}
				blob = await fileResponse.blob();
			} else {
				throw new Error(m.toast_download_no_url_or_content());
			}

			toast.loading(m.toast_downloading_file({ fileName: downloadFileName }), {
				id: toastId,
			});

			this.downloadBlob(blob, downloadFileName);

			toast.success(m.toast_download_file_success({ fileName: downloadFileName }), {
				id: toastId,
			});
		} catch (e) {
			const errorMsg = getSandboxDownloadErrorMessage(e);
			toast.error(errorMsg, { id: toastId });
		}
	}

	/**
	 * Download blob helper
	 */
	private downloadBlob(blob: Blob, fileName: string): void {
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}

	/**
	 * Select file
	 */
	selectFile(file: SandboxFileInfo): void {
		if (file.type === "file") {
			this.selectedFile = file.path;
		}
	}
}
