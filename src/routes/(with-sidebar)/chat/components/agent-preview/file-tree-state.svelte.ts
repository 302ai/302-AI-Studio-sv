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
import { claudeCodeAgentState } from "$lib/stores/code-agent";
import { persistedProviderState } from "$lib/stores/provider-state.svelte";
import { toast } from "svelte-sonner";
import { SvelteDate, SvelteMap, SvelteSet } from "svelte/reactivity";
import { DEFAULT_WORKSPACE_PATH } from "./constants";
import { handleError, validatePath, validateSandboxId, withRetry } from "./utils";

export interface TreeNode extends SandboxFileInfo {
	children: TreeNode[];
	depth: number;
	isExpanded?: boolean;
}

interface TreeCache {
	files: SandboxFileInfo[];
	nodes: TreeNode[];
	expandedDirs: SvelteSet<string>;
}

/**
 * Breadcrumb segment for navigation
 */
export interface BreadcrumbSegment {
	name: string;
	path: string;
	isLast: boolean;
}

/**
 * Path utility functions
 */
const pathUtils = {
	getParentDir: (path: string): string => path.substring(0, path.lastIndexOf("/")),
	getFileName: (path: string): string => path.split("/").pop() || "file",
	join: (...parts: string[]): string => parts.filter(Boolean).join("/"),
	normalize: (path: string): string => (path.startsWith("/") ? path : `/${path}`),
};

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
	files = $state<SandboxFileInfo[]>([]);
	treeNodes = $state<TreeNode[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	expandedDirs = $state(new SvelteSet([DEFAULT_WORKSPACE_PATH]));
	selectedFile = $state<string | null>(null);
	loadedDirs = $state(new SvelteSet<string>());
	loadingDirs = $state(new SvelteSet<string>());
	downloadingPaths = $state(new SvelteSet<string>());
	operatingPaths = $state(new SvelteSet<string>());
	copiedFilePath = $state<string | null>(null);
	treeNodesCache = $state<TreeCache | null>(null);
	syncUnsubscribe: (() => void) | null = null;

	// Navigation state - current directory being viewed
	currentDirectory = $state<string>(DEFAULT_WORKSPACE_PATH);

	// Derived state
	isStreaming = $derived(chatState.isStreaming || chatState.isSubmitted);

	// Computed root path - uses workspacePath if set, otherwise falls back to DEFAULT_WORKSPACE_PATH
	get rootPath(): string {
		return this.workspacePath || DEFAULT_WORKSPACE_PATH;
	}

	// Derived: breadcrumb segments for current directory
	get breadcrumbSegments(): BreadcrumbSegment[] {
		return this.buildBreadcrumb(this.currentDirectory);
	}

	// Derived: items in current directory (flat view)
	get currentItems(): SandboxFileInfo[] {
		return this.getDirectoryItems(this.currentDirectory);
	}

	// Check if currently at root directory
	get isAtRoot(): boolean {
		return this.currentDirectory === this.rootPath;
	}

	constructor(sandboxId: string, workspacePath?: string) {
		this.sandboxId = sandboxId;
		if (workspacePath) {
			this.workspacePath = workspacePath;
			this.expandedDirs = new SvelteSet([workspacePath]);
			this.currentDirectory = workspacePath;
		}
	}

	updateSandboxId(sandboxId: string) {
		this.sandboxId = sandboxId;
		// Reset navigation to root on sandbox change
		this.currentDirectory = this.rootPath;
	}

	updateWorkspacePath(workspacePath: string) {
		if (workspacePath && workspacePath !== this.workspacePath) {
			this.workspacePath = workspacePath;
			// Update expanded dirs to include the new workspace path
			this.expandedDirs = new SvelteSet([workspacePath]);
			// Reset navigation to new root
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
		const provider = persistedProviderState.current.find((p) => p.name === "302.AI" && p.enabled);
		const key = provider?.apiKey || "";
		return key;
	}

	/**
	 * Build tree structure with memoization
	 */
	buildTreeStructure(fileList: SandboxFileInfo[]): TreeNode[] {
		if (!fileList || fileList.length === 0) {
			return [];
		}

		// Check cache
		if (
			this.treeNodesCache &&
			this.treeNodesCache.files.length === fileList.length &&
			this.treeNodesCache.expandedDirs.size === this.expandedDirs.size &&
			JSON.stringify(this.treeNodesCache.files.map((f) => f.path).sort()) ===
				JSON.stringify(fileList.map((f) => f.path).sort()) &&
			JSON.stringify([...this.treeNodesCache.expandedDirs].sort()) ===
				JSON.stringify([...this.expandedDirs].sort())
		) {
			console.log("[FileTree] Using cached tree structure");
			return this.treeNodesCache.nodes;
		}

		// Create path to node mapping
		const nodeMap = new SvelteMap<string, TreeNode>();
		const rootNodes: TreeNode[] = [];

		// Sort by path depth to ensure parent nodes are processed before children
		const sortedFiles = [...fileList].sort((a, b) => {
			const aDepth = a.path.split("/").filter(Boolean).length;
			const bDepth = b.path.split("/").filter(Boolean).length;
			if (aDepth !== bDepth) return aDepth - bDepth;
			return a.path.localeCompare(b.path);
		});

		// Find minimum depth for relative depth calculation
		const minDepth = Math.min(...sortedFiles.map((f) => f.path.split("/").filter(Boolean).length));

		for (const file of sortedFiles) {
			const pathParts = file.path.split("/").filter(Boolean);
			const absoluteDepth = pathParts.length;
			const depth = absoluteDepth - minDepth; // Relative depth

			const node: TreeNode = {
				...file,
				children: [],
				depth,
				isExpanded: this.expandedDirs.has(file.path),
			};

			nodeMap.set(file.path, node);

			// Find parent node
			const parentPath = pathParts.slice(0, -1).join("/");
			const fullParentPath = parentPath ? `/${parentPath}` : "";

			if (fullParentPath && nodeMap.has(fullParentPath)) {
				const parentNode = nodeMap.get(fullParentPath)!;
				parentNode.children.push(node);
			} else {
				rootNodes.push(node);
			}
		}

		// Update cache
		this.treeNodesCache = {
			files: [...fileList],
			nodes: rootNodes,
			expandedDirs: new SvelteSet(this.expandedDirs),
		};

		return rootNodes;
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
		updates?: Partial<{ selectedFilePath: string | null; currentNavigationDirectory?: string }>,
		shouldBroadcast: boolean = false,
	): Promise<void> {
		const sessionId = claudeCodeAgentState.currentSessionId;
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
			currentWorkingDirectory: existingStorage?.currentWorkingDirectory,
			terminalHistory: existingStorage?.terminalHistory,
			type: existingStorage?.type,
			currentNavigationDirectory:
				updates?.currentNavigationDirectory ??
				this.currentDirectory ??
				existingStorage?.currentNavigationDirectory,
			lastUpdated: new SvelteDate().toISOString(),
		});

		if (shouldBroadcast) {
			agentPreviewState.broadcastFileListSync({
				sandboxId: this.sandboxId,
				sessionId,
				fileList: this.files,
				selectedFilePath: updates?.selectedFilePath ?? this.selectedFile,
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

		const sessionId = claudeCodeAgentState.currentSessionId;
		if (!sessionId) {
			return;
		}

		try {
			const storage = await agentPreviewState.loadFromStorage(this.sandboxId, sessionId);
			if (storage && storage.fileList.length > 0) {
				this.files = storage.fileList;
				this.treeNodes = this.buildTreeStructure(this.files);
				this.loadedDirs = this.inferLoadedDirsFromFiles(this.files);
				// Restore navigation directory from storage
				if (storage.currentNavigationDirectory) {
					this.currentDirectory = storage.currentNavigationDirectory;
				}
			} else if (clearIfNotFound) {
				this.files = [];
				this.treeNodes = [];
				this.loadedDirs = new SvelteSet();
				this.currentDirectory = this.rootPath;
			} else {
				console.log("[FileTree] No data in storage, keeping existing files");
			}
		} catch (e) {
			console.error("[FileTree] Failed to load from storage:", e);
			if (clearIfNotFound) {
				this.files = [];
				this.treeNodes = [];
				this.loadedDirs = new SvelteSet();
				this.currentDirectory = this.rootPath;
			}
		}
	}

	/**
	 * Load files from API
	 */
	async loadFiles(
		path: string = DEFAULT_WORKSPACE_PATH,
		merge: boolean = false,
		force: boolean = false,
	): Promise<void> {
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

		// Do not load files while agent is streaming
		if (this.isStreaming) {
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

			const response = await withRetry(
				() => listSandboxFiles(this.sandboxId, path, apiKey, undefined, 2),
				3,
				1000,
			);

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
			this.error = e instanceof Error ? e.message : m.toast_file_operation_load_failed();
			handleError(e, "Load sandbox files", false);
			if (!merge) {
				this.files = [];
				this.treeNodes = [];
				this.treeNodesCache = null;
			}
		} finally {
			this.loadingDirs = removeFromSet(this.loadingDirs, path);
			if (!merge || force) {
				this.loading = false;
			}
		}
	}

	/**
	 * Refresh file tree (reset and reload from root)
	 */
	async refreshFileTree(): Promise<void> {
		this.loadedDirs = new SvelteSet();
		this.treeNodesCache = null;
		this.expandedDirs = new SvelteSet([this.rootPath]);
		await this.loadFiles(this.rootPath, false, true);
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
			const response = await renameSandboxFile(this.sandboxId, oldPath, newPath, validation.apiKey);

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
			const response = await deleteSandboxFile(this.sandboxId, path, validation.apiKey);

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

		// Find source file
		const sourceFile = this.files.find((f) => f.path === sourcePath);
		if (!sourceFile) {
			toast.error(m.toast_file_paste_failed());
			this.operatingPaths = removeFromSet(this.operatingPaths, sourcePath);
			return false;
		}

		// Build destination path
		const sourceName = pathUtils.getFileName(sourcePath);
		const destPath = `${targetDir.path}/${sourceName}`;

		const toastId = toast.loading(m.toast_file_pasting());

		try {
			const response = await copySandboxFile(
				this.sandboxId,
				sourcePath,
				destPath,
				validation.apiKey,
			);

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

			const response = await uploadSandboxFile(this.sandboxId, fullPath, file, apiKey);

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

				// Expand parent directory
				if (!this.expandedDirs.has(parentPath)) {
					this.expandedDirs = addToSet(this.expandedDirs, parentPath);
				}

				await this.updateFilesAndRebuild(this.files);
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

		const apiKey = this.get302ApiKey();
		if (!apiKey) {
			toast.error(m.toast_file_operation_api_key_not_found());
			return false;
		}

		this.operatingPaths = addToSet(this.operatingPaths, targetPath);
		const toastId = toast.loading(m.toast_file_uploading());

		try {
			// Construct full path including filename
			// The API expects the full path of the file, not just the directory
			const fullPath = targetPath.endsWith("/")
				? `${targetPath}${file.name}`
				: `${targetPath}/${file.name}`;

			const response = await uploadSandboxFile(this.sandboxId, fullPath, file, apiKey);

			if (response.success) {
				toast.success(m.toast_file_upload_success(), { id: toastId });

				// Refresh the target directory to show the new file
				// If targetPath is the root or a loaded directory, we need to refresh it
				if (targetPath === DEFAULT_WORKSPACE_PATH || this.loadedDirs.has(targetPath)) {
					// Add a small delay to ensure the server has processed the upload
					await new Promise((resolve) => setTimeout(resolve, 500));
					await this.loadFiles(targetPath, true, true); // Merge mode + Force update
				} else {
					// If we uploaded to a subdirectory that isn't loaded, we might want to load it
					// or just let the user expand it later.
					// For now, let's try to refresh the parent of the uploaded file location if possible
					// But since we upload to a 'path' which is a directory, we just refresh that directory.
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
				apiKey,
				undefined,
				true, // auto_unzip
			);

			if (response.success) {
				toast.success(m.toast_file_upload_folder_success(), { id: uploadToastId });

				// Refresh the target directory
				if (targetPath === DEFAULT_WORKSPACE_PATH || this.loadedDirs.has(targetPath)) {
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
			const response = await createSandboxFolder(this.sandboxId, targetPath, apiKey);

			if (response.success) {
				toast.success(m.toast_file_create_folder_success(), { id: toastId });

				// Refresh the parent directory
				if (parentPath === DEFAULT_WORKSPACE_PATH || this.loadedDirs.has(parentPath)) {
					await new Promise((resolve) => setTimeout(resolve, 500));
					await this.loadFiles(parentPath, true, true);

					// Also expand the parent directory if not already expanded
					if (!this.expandedDirs.has(parentPath)) {
						this.expandedDirs = addToSet(this.expandedDirs, parentPath);
						this.rebuildTree();
					}
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
			const response = await downloadSandboxFile(this.sandboxId, file.path, apiKey);

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
			const errorMsg = e instanceof Error ? e.message : m.toast_download_failed();
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
				console.error("[FileTree] Failed to download folder:", e);
				failCount++;

				toast.loading(m.toast_downloading_folder(), {
					id: toastId,
				});
			}
		}

		// Show result
		if (successCount > 0) {
			const failedText = failCount > 0 ? m.toast_download_folder_success_failed({ failCount }) : "";
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
					throw new Error(m.toast_download_file_failed({ error: fileResponse.statusText }));
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
			const errorMsg = e instanceof Error ? e.message : m.toast_download_failed();
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

	// ==================== Navigation Methods ====================

	/**
	 * Build breadcrumb segments from a path
	 */
	buildBreadcrumb(path: string): BreadcrumbSegment[] {
		const segments: BreadcrumbSegment[] = [];
		const rootPath = this.rootPath;

		// Always add root as first segment
		const rootName = pathUtils.getFileName(rootPath) || "root";
		segments.push({
			name: rootName,
			path: rootPath,
			isLast: path === rootPath,
		});

		if (path === rootPath) {
			return segments;
		}

		// Get the relative path from root
		const relativePath = path.startsWith(rootPath) ? path.slice(rootPath.length) : path;
		const parts = relativePath.split("/").filter(Boolean);

		let currentPath = rootPath;
		for (let i = 0; i < parts.length; i++) {
			currentPath = `${currentPath}/${parts[i]}`;
			segments.push({
				name: parts[i],
				path: currentPath,
				isLast: i === parts.length - 1,
			});
		}

		return segments;
	}

	/**
	 * Get immediate children of a directory (flat view)
	 */
	getDirectoryItems(dirPath: string): SandboxFileInfo[] {
		const normalizedDir = pathUtils.normalize(dirPath);
		const normalizedDirPath = normalizedDir.endsWith("/")
			? normalizedDir.slice(0, -1)
			: normalizedDir;

		return this.files.filter((file) => {
			const parentDir = pathUtils.getParentDir(file.path);
			return parentDir === normalizedDirPath;
		});
	}

	/**
	 * Get parent directory path
	 */
	getParentDirectory(path: string): string {
		const parent = pathUtils.getParentDir(path);
		// Don't go above root
		if (!parent || parent.length < this.rootPath.length) {
			return this.rootPath;
		}
		return parent;
	}

	/**
	 * Navigate to a directory
	 */
	async navigateToDirectory(path: string): Promise<void> {
		if (!path) {
			return;
		}

		// Update current directory
		this.currentDirectory = path;

		// Load directory contents if not already loaded
		if (!this.loadedDirs.has(path) && !this.hasDirectChildren(path)) {
			await this.loadFiles(path, true);
		} else if (!this.loadedDirs.has(path) && this.hasDirectChildren(path)) {
			this.loadedDirs = addToSet(this.loadedDirs, path);
		}

		// Also expand the directory in tree view for consistency
		if (!this.expandedDirs.has(path)) {
			this.expandedDirs = addToSet(this.expandedDirs, path);
		}

		// Save navigation state to storage
		await this.saveToStorage({ currentNavigationDirectory: path }, false);
	}

	/**
	 * Navigate back to parent directory
	 */
	async navigateBack(): Promise<void> {
		if (this.isAtRoot) {
			return;
		}

		const parentPath = this.getParentDirectory(this.currentDirectory);
		await this.navigateToDirectory(parentPath);
	}

	/**
	 * Navigate to root directory
	 */
	async navigateToRoot(): Promise<void> {
		await this.navigateToDirectory(this.rootPath);
	}
}
