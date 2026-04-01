<script lang="ts">
	import type { SandboxFileInfo } from "$lib/api/sandbox-file";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import {
		ArrowDownToLine,
		File,
		FilePlus,
		FileUp,
		Folder,
		FolderOpen,
		FolderPlus,
		FolderUp,
		Loader2,
		RefreshCw,
	} from "@lucide/svelte";
	import { onDestroy } from "svelte";
	import { toast } from "svelte-sonner";
	import { DEFAULT_WORKSPACE_PATH } from "./constants";
	import { FileTreeState, type TreeNode } from "./file-tree-state.svelte";

	interface Props {
		sandboxId: string;
		workspacePath?: string;
		onFileSelect?: (file: SandboxFileInfo) => void;
		refreshTrigger?: number;
		onFileDelete?: (file: SandboxFileInfo) => void;
	}

	let { sandboxId, workspacePath, onFileSelect, refreshTrigger, onFileDelete }: Props = $props();

	// Initialize file tree state
	const fileTreeState = new FileTreeState(sandboxId, workspacePath);

	// Check if we are in local vibe mode
	const isLocalVibeMode = $derived(codeAgentState.enabled && codeAgentState.type === "local");

	// Handle open local
	async function handleOpenLocal(targetPath?: string) {
		const path = targetPath ?? fileTreeState.currentDirectory;
		if (!path) return;

		// Remove workspace prefix if present to get path relative to workspace root
		let relativePath = path;
		if (relativePath.startsWith(DEFAULT_WORKSPACE_PATH)) {
			relativePath = relativePath.slice(DEFAULT_WORKSPACE_PATH.length);
		}

		// Remove leading slash if present to ensure relative path
		relativePath = relativePath.startsWith("/") ? relativePath.slice(1) : relativePath;
		await window.electronAPI.localVibeService.openWorkspaceDirectory(relativePath);
	}

	// UI-specific state for rename dialog
	let renamingPath = $state<string | null>(null);
	let renameDialogOpen = $state(false);
	let renameInputValue = $state("");
	let renamingInProgress = $state(false);
	const renamingNodeType = $derived(
		renamingPath ? fileTreeState.files.find((f) => f.path === renamingPath)?.type : null,
	);

	// UI-specific state for create file dialog
	let createFilePath = $state<string | null>(null); // The directory to create file in
	let createFileDialogOpen = $state(false);
	let createFileInputValue = $state("");
	let creatingFileInProgress = $state(false);

	// UI-specific state for create folder dialog
	let createFolderParentPath = $state<string | null>(null);
	let createFolderDialogOpen = $state(false);
	let createFolderInputValue = $state("");
	let createFolderInProgress = $state(false);

	// UI-specific state for delete confirmation dialog
	let deleteDialogOpen = $state(false);
	let deleteNode = $state<TreeNode | null>(null);
	let deletingInProgress = $state(false);

	// Validate file name
	function validateFileName(name: string): boolean {
		if (!name || name.trim().length === 0) {
			return false;
		}
		// 不允许包含特殊字符：/ \ : * ? " < > |
		const invalidChars = /[/\\:*?"<>|]/;
		return !invalidChars.test(name);
	}

	// Handle file click - always allowed, even during streaming (view-only)
	function handleFileClick(file: SandboxFileInfo) {
		if (fileTreeState.selectedFile === file.path) return;
		fileTreeState.selectFile(file);
		onFileSelect?.(file);
	}

	// Check if modification operations are disabled (streaming or loading)
	const isModificationDisabled = $derived(fileTreeState.isStreaming || fileTreeState.loading);

	// Handle create file start
	function handleCreateFile(parentPath?: string) {
		createFilePath = parentPath ?? fileTreeState.currentDirectory;
		createFileInputValue = "";
		createFileDialogOpen = true;
	}

	// Confirm create file
	async function confirmCreateFile() {
		if (!createFilePath) {
			return;
		}

		const fileName = createFileInputValue.trim();
		if (!validateFileName(fileName)) {
			toast.error(m.toast_file_rename_invalid_name()); // Use same error for now or add specific one
			return;
		}

		if (creatingFileInProgress) {
			return;
		}

		creatingFileInProgress = true;
		const newFile = await fileTreeState.createFile(fileName, createFilePath);
		creatingFileInProgress = false;

		if (newFile) {
			createFileDialogOpen = false;
			createFilePath = null;
			createFileInputValue = "";

			// Trigger file select callback to download the new file content
			// Note: We call onFileSelect directly instead of handleFileClick because
			// createFile() has already set selectedFile, which would cause handleFileClick
			// to skip the callback (due to the "already selected" early return check)
			onFileSelect?.(newFile);
		}
	}

	// Handle rename
	async function handleRename(file: SandboxFileInfo) {
		renamingPath = file.path;
		renameInputValue = file.name;
		renameDialogOpen = true;
	}

	// Confirm rename
	async function confirmRename() {
		if (!renamingPath) {
			return;
		}

		const newName = renameInputValue.trim();
		if (!validateFileName(newName)) {
			toast.error(m.toast_file_rename_invalid_name());
			return;
		}

		const oldPath = renamingPath;
		const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/"));
		const newPath = parentDir ? `${parentDir}/${newName}` : `/${newName}`;

		if (oldPath === newPath) {
			renameDialogOpen = false;
			renamingPath = null;
			renameInputValue = "";
			return;
		}

		if (renamingInProgress) {
			return;
		}

		renamingInProgress = true;
		const nodeType = fileTreeState.files.find((f) => f.path === oldPath)?.type;
		let success: boolean;
		if (nodeType === "dir") {
			success = await fileTreeState.renameFolder(oldPath, newPath, newName);
		} else {
			success = await fileTreeState.renameFile(oldPath, newPath, newName);
		}
		renamingInProgress = false;

		if (success) {
			renameDialogOpen = false;
			renamingPath = null;
			renameInputValue = "";
		}
	}

	// Handle delete - show confirmation dialog
	function handleDelete(file: SandboxFileInfo) {
		deleteNode = file as TreeNode;
		deleteDialogOpen = true;
	}

	// Confirm delete
	async function confirmDelete() {
		if (!deleteNode || deletingInProgress) {
			return;
		}

		deletingInProgress = true;
		const success = await fileTreeState.deleteFile(deleteNode.path);
		deletingInProgress = false;

		if (success) {
			onFileDelete?.(deleteNode);
			deleteDialogOpen = false;
			deleteNode = null;
		}
	}

	// Handle copy
	function handleCopy(file: SandboxFileInfo) {
		fileTreeState.copyFile(file.path);
	}

	// Handle paste
	async function handlePaste(targetDir: SandboxFileInfo) {
		if (!fileTreeState.copiedFilePath) {
			return;
		}
		await fileTreeState.pasteFile(fileTreeState.copiedFilePath, targetDir);
	}

	// Handle download
	async function handleDownload(file: SandboxFileInfo) {
		await fileTreeState.downloadFile(file);
	}

	// Track previous sandboxId, sessionId, and workspacePath to detect changes
	let previousSandboxId = $state<string | undefined>(undefined);
	let previousSessionId = $state<string | null>(null);
	let previousWorkspacePath = $state<string | undefined>(undefined);
	let hasLoadedWithWorkspacePath = $state(false);
	let isLoadingFromStorage = $state(true); // Prevent workspace effect from firing during initial load

	// Effect to update workspace path when it changes
	$effect(() => {
		const currentWorkspacePath = workspacePath;
		const wasEmpty = !previousWorkspacePath;
		const isNowValid = !!currentWorkspacePath;

		if (currentWorkspacePath && currentWorkspacePath !== previousWorkspacePath) {
			previousWorkspacePath = currentWorkspacePath;
			fileTreeState.updateWorkspacePath(currentWorkspacePath);

			// If workspace path just became available and we haven't loaded with it yet,
			// trigger a refresh to load files from the correct path
			// Skip if we're still loading from storage (initial load)
			const shouldRefresh =
				wasEmpty &&
				isNowValid &&
				!hasLoadedWithWorkspacePath &&
				!isLoadingFromStorage &&
				sandboxId;

			if (shouldRefresh) {
				hasLoadedWithWorkspacePath = true;
				if (!fileTreeState.isStreaming) {
					fileTreeState.refreshFileTree();
				}
			}
		}
	});

	// Combined effect to handle sandboxId/sessionId changes and loading
	$effect(() => {
		const currentSessionId = codeAgentState.currentSessionId;
		const sandboxChanged = sandboxId !== previousSandboxId;
		const sessionChanged = currentSessionId !== previousSessionId;

		if (!sandboxId || !currentSessionId) {
			fileTreeState.disposeSyncListener();
		} else {
			fileTreeState.setupSyncListener(currentSessionId);
		}

		if (sandboxChanged || sessionChanged) {
			// Capture old values for logic
			const oldSandboxId = previousSandboxId;
			const oldSessionId = previousSessionId;

			// Update trackers immediately
			previousSandboxId = sandboxId;
			previousSessionId = currentSessionId;

			// 1. Update Sandbox ID in state
			if (sandboxChanged) {
				fileTreeState.updateSandboxId(sandboxId);
			}

			// 2. Load from storage logic
			const isRealChange =
				(sandboxChanged && oldSandboxId !== undefined) ||
				(sessionChanged && oldSessionId !== null);
			const isComponentRecreation = oldSandboxId === undefined && oldSessionId === null;

			if (sandboxId && currentSessionId) {
				const shouldClear = isRealChange;

				(async () => {
					// Reset workspace path tracking only for real changes (not component recreation)
					// This must be done inside the async block to avoid race condition with workspace path effect
					if (isRealChange) {
						hasLoadedWithWorkspacePath = false;
					}

					await fileTreeState.loadFromStorage(shouldClear);

					// Mark initial loading as complete - this allows workspace path effect to work for future changes
					isLoadingFromStorage = false;

					// If we successfully loaded files from storage, mark as loaded to prevent
					// the workspace path effect from triggering an unnecessary API refresh
					if (fileTreeState.files.length > 0) {
						hasLoadedWithWorkspacePath = true;
					}

					const shouldLoadFromAPI =
						(isRealChange || isComponentRecreation) && fileTreeState.files.length === 0;

					const shouldRefreshAfterStorage =
						isComponentRecreation &&
						!fileTreeState.isStreaming &&
						!!workspacePath &&
						!!sandboxId &&
						!!currentSessionId;

					// Only load from API if we have a valid workspace path
					// If workspace path is empty, wait for it to be set by the workspace path effect
					if (shouldLoadFromAPI) {
						if (!fileTreeState.isStreaming) {
							if (workspacePath) {
								hasLoadedWithWorkspacePath = true;
								await fileTreeState.refreshFileTree();
							}
						}
					} else if (shouldRefreshAfterStorage) {
						hasLoadedWithWorkspacePath = true;
						await fileTreeState.refreshFileTree();
					}
				})();
			}
		}
	});

	onDestroy(() => {
		fileTreeState.disposeSyncListener();
	});

	// Watch for refresh trigger changes
	let previousRefreshTrigger = $state<number | undefined>(refreshTrigger);
	$effect(() => {
		if (refreshTrigger !== undefined && refreshTrigger !== previousRefreshTrigger) {
			previousRefreshTrigger = refreshTrigger;

			if (sandboxId && !fileTreeState.isStreaming) {
				// Only refresh if workspace path is available
				// If not, the workspace path effect will handle it when path becomes available
				if (workspacePath) {
					fileTreeState.refreshFileTree();
				}
			}
		}
	});

	// File upload
	let fileInput: HTMLInputElement;
	let pendingUploadPath = $state<string | null>(null);

	function triggerFileUpload(path?: string) {
		pendingUploadPath = path ?? fileTreeState.currentDirectory;
		fileInput.click();
	}

	async function handleFileUpload(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			const file = target.files[0];
			// Upload to pendingUploadPath
			await fileTreeState.uploadFile(
				file,
				pendingUploadPath ?? fileTreeState.currentDirectory,
			);

			// Reset input and path
			target.value = "";
			pendingUploadPath = null;
		}
	}

	// Folder upload - uses Electron dialog
	async function handleFolderUpload(targetPath?: string) {
		await fileTreeState.uploadFolder(targetPath ?? fileTreeState.currentDirectory);
	}

	// Handle create folder
	function handleCreateFolder(parentPath?: string) {
		createFolderParentPath = parentPath ?? fileTreeState.currentDirectory;
		createFolderInputValue = "";
		createFolderDialogOpen = true;
	}

	// Confirm create folder
	async function confirmCreateFolder() {
		if (!createFolderParentPath) {
			return;
		}

		const folderName = createFolderInputValue.trim();
		if (!validateFileName(folderName)) {
			toast.error(m.toast_file_rename_invalid_name());
			return;
		}

		if (createFolderInProgress) {
			return;
		}

		createFolderInProgress = true;
		const success = await fileTreeState.createFolder(createFolderParentPath, folderName);
		createFolderInProgress = false;

		if (success) {
			createFolderDialogOpen = false;
			createFolderParentPath = null;
			createFolderInputValue = "";
		}
	}
</script>

{#snippet contextMenuContent(node: TreeNode)}
	{#if node.isParentEntry}
		<!-- No context menu for parent entry ("..") per Requirements 6.3 -->
	{:else}
		{@const isFile = node.type === "file"}
		{@const isDir = node.type === "dir"}
		{@const isOperating = fileTreeState.operatingPaths.has(node.path)}
		{@const isDownloading = fileTreeState.downloadingPaths.has(node.path)}
		{@const isPasteOperating = fileTreeState.copiedFilePath
			? fileTreeState.operatingPaths.has(fileTreeState.copiedFilePath)
			: false}

		<ContextMenu.Content>
			{#if isFile}
				<!-- Rename -->
				<ContextMenu.Item
					onSelect={() => handleRename(node)}
					disabled={isOperating || isModificationDisabled}
				>
					{#if isOperating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}{/if}
					<span>{m.title_button_rename()}</span>
				</ContextMenu.Item>
			{/if}

			<!-- Copy - always allowed -->
			<ContextMenu.Item onSelect={() => handleCopy(node)} disabled={isOperating}>
				<span>{m.common_copy()}</span>
			</ContextMenu.Item>

			{#if isDir}
				<!-- Rename Folder -->
				<ContextMenu.Item
					onSelect={() => handleRename(node)}
					disabled={isOperating || isModificationDisabled}
				>
					{#if isOperating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}{/if}
					<span>{m.title_button_rename()}</span>
				</ContextMenu.Item>

				<!-- Paste -->
				<ContextMenu.Item
					onSelect={() => handlePaste(node)}
					disabled={!fileTreeState.copiedFilePath ||
						isPasteOperating ||
						isModificationDisabled}
				>
					{#if isPasteOperating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}{/if}
					<span>{m.label_file_tree_paste()}</span>
				</ContextMenu.Item>
				<ContextMenu.Separator />

				<!-- New Folder -->
				<ContextMenu.Item
					onSelect={() => handleCreateFolder(node.path)}
					disabled={isOperating || isModificationDisabled}
				>
					{#if isOperating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}{/if}
					<span>{m.label_file_tree_new_folder()}</span>
				</ContextMenu.Item>

				<!-- Create File -->
				<ContextMenu.Item
					onSelect={() => handleCreateFile(node.path)}
					disabled={isOperating || isModificationDisabled}
				>
					{#if isOperating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}{/if}
					<span>{m.label_file_tree_create_file()}</span>
				</ContextMenu.Item>
				<ContextMenu.Separator />

				<!-- Upload File -->
				<ContextMenu.Item
					onSelect={() => triggerFileUpload(node.path)}
					disabled={isOperating || isModificationDisabled}
				>
					{#if isOperating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}{/if}
					<span>{m.label_file_tree_upload_file()}</span>
				</ContextMenu.Item>

				<!-- Upload Folder -->
				<ContextMenu.Item
					onSelect={() => handleFolderUpload(node.path)}
					disabled={isOperating || isModificationDisabled}
				>
					{#if isOperating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{:else}{/if}
					<span>{m.label_file_tree_upload_folder()}</span>
				</ContextMenu.Item>
			{/if}

			<ContextMenu.Separator />

			<ContextMenu.Item onSelect={() => handleDownload(node)} disabled={isDownloading}>
				{#if isDownloading}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}{/if}
				<span>{m.label_file_tree_download()}</span>
			</ContextMenu.Item>

			<!-- Open Local File -->
			{#if isLocalVibeMode}
				<ContextMenu.Item onSelect={() => handleOpenLocal(node.path)}>
					<span>{m.label_file_tree_open_local()}</span>
				</ContextMenu.Item>
			{/if}

			<!-- Delete -->
			<!-- {#if !isDir} -->
			<ContextMenu.Separator />
			<ContextMenu.Item
				onSelect={() => handleDelete(node)}
				disabled={isOperating || isModificationDisabled}
				class="text-destructive focus:text-destructive"
			>
				{#if isOperating}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{:else}{/if}
				<span>{m.text_button_delete()}</span>
			</ContextMenu.Item>
			<!-- {/if} -->
		</ContextMenu.Content>
	{/if}
{/snippet}

{#snippet emptyAreaContextMenu()}
	{@const isPasteOperating = fileTreeState.copiedFilePath
		? fileTreeState.operatingPaths.has(fileTreeState.copiedFilePath)
		: false}

	<ContextMenu.Content>
		<!-- Paste -->
		<ContextMenu.Item
			onSelect={() => {
				// Create a virtual directory node for the current directory
				const currentDirNode = {
					path: fileTreeState.currentDirectory,
					name: fileTreeState.currentDirectory.split("/").pop() || "",
					type: "dir" as const,
				};
				handlePaste(currentDirNode);
			}}
			disabled={!fileTreeState.copiedFilePath || isPasteOperating || isModificationDisabled}
		>
			{#if isPasteOperating}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
			{/if}
			<span>{m.label_file_tree_paste()}</span>
		</ContextMenu.Item>
		<ContextMenu.Separator />

		<!-- New Folder -->
		<ContextMenu.Item onSelect={() => handleCreateFolder()} disabled={isModificationDisabled}>
			<span>{m.label_file_tree_new_folder()}</span>
		</ContextMenu.Item>

		<!-- Create File -->
		<ContextMenu.Item onSelect={() => handleCreateFile()} disabled={isModificationDisabled}>
			<span>{m.label_file_tree_create_file()}</span>
		</ContextMenu.Item>
		<ContextMenu.Separator />

		<!-- Upload File -->
		<ContextMenu.Item onSelect={() => triggerFileUpload()} disabled={isModificationDisabled}>
			<span>{m.label_file_tree_upload_file()}</span>
		</ContextMenu.Item>

		<ContextMenu.Item onSelect={() => handleFolderUpload()} disabled={isModificationDisabled}>
			<span>{m.label_file_tree_upload_folder()}</span>
		</ContextMenu.Item>

		{#if isLocalVibeMode}
			<ContextMenu.Separator />

			<!-- Open Local File -->
			<ContextMenu.Item onSelect={() => handleOpenLocal()}>
				<span>{m.label_file_tree_open_local()}</span>
			</ContextMenu.Item>
		{/if}
	</ContextMenu.Content>
{/snippet}

{#snippet treeNodeItem(node: TreeNode)}
	{#if node.isParentEntry}
		<!-- Parent directory entry ("..") -->
		<button
			type="button"
			ondblclick={() => fileTreeState.navigateToParent()}
			class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			style="padding-left: 12px"
			disabled={fileTreeState.isParentLoading}
		>
			<div class="flex items-center gap-1.5 flex-1 min-w-0">
				{#if fileTreeState.isParentLoading}
					<Loader2 class="h-3 w-3 flex-shrink-0 animate-spin text-muted-foreground" />
				{:else}
					<span class="h-3 w-3 flex-shrink-0"></span>
				{/if}
				<FolderUp class="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
				<span class="truncate text-xs font-medium text-muted-foreground">..</span>
			</div>
		</button>
	{:else if node.type === "dir"}
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				<button
					type="button"
					ondblclick={() => fileTreeState.navigateToFolder(node.path)}
					class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					style="padding-left: {node.depth * 20 + 12}px"
					disabled={fileTreeState.loadingDirs.has(node.path)}
				>
					<div class="flex items-center gap-1.5 flex-1 min-w-0">
						{#if fileTreeState.loadingDirs.has(node.path)}
							<Loader2
								class="h-3 w-3 flex-shrink-0 animate-spin text-muted-foreground"
							/>
							<Folder class="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
						{:else if fileTreeState.selectedFile === node.path}
							<span class="h-3 w-3 flex-shrink-0"></span>
							<FolderOpen class="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
						{:else}
							<span class="h-3 w-3 flex-shrink-0"></span>
							<Folder class="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
						{/if}
						<span class="truncate text-xs font-medium">{node.name}</span>
					</div>
				</button>
			</ContextMenu.Trigger>
			{@render contextMenuContent(node)}
		</ContextMenu.Root>
	{:else}
		<ContextMenu.Root>
			<ContextMenu.Trigger>
				<button
					type="button"
					onclick={() => handleFileClick(node)}
					class={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-muted transition-colors ${
						fileTreeState.selectedFile === node.path ? "bg-muted" : ""
					}`}
					style="padding-left: {node.depth * 20 + 12}px"
				>
					<div class="flex items-center gap-1.5 flex-1 min-w-0">
						<span class="h-3 w-3 flex-shrink-0"></span>

						<File class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
						<span class="truncate text-xs">{node.name}</span>
					</div>
				</button>
			</ContextMenu.Trigger>
			{@render contextMenuContent(node)}
		</ContextMenu.Root>
	{/if}
{/snippet}

<div class="flex h-full flex-col bg-background">
	<!-- Header -->
	<div
		class="flex items-center justify-between border-b border-border px-3 py-2 gap-2"
		style="container-type: inline-size;"
	>
		<!-- Wide layout: show all buttons -->
		<div class="[@container(min-width:135px)]:flex hidden items-center gap-1">
			<!-- Create File -->
			<ButtonWithTooltip
				tooltip={m.title_button_create_file()}
				onclick={() => handleCreateFile()}
				class="h-7 w-7 hover:!bg-chat-action-hover"
				disabled={isModificationDisabled}
			>
				<FilePlus class="h-4 w-4" strokeWidth={1.25} />
			</ButtonWithTooltip>

			<!-- Create Folder -->
			<ButtonWithTooltip
				tooltip={m.title_button_new_folder()}
				onclick={() => handleCreateFolder()}
				class="h-7 w-7 hover:!bg-chat-action-hover"
				disabled={isModificationDisabled}
			>
				<FolderPlus class="h-4 w-4" strokeWidth={1.25} />
			</ButtonWithTooltip>

			<!-- Upload File -->
			<ButtonWithTooltip
				tooltip={m.label_file_tree_upload_file()}
				onclick={() => triggerFileUpload()}
				class="h-7 w-7 hover:!bg-chat-action-hover"
				disabled={isModificationDisabled}
			>
				<FileUp class="h-4 w-4" strokeWidth={1.25} />
			</ButtonWithTooltip>

			<!-- Upload Folder -->
			<ButtonWithTooltip
				tooltip={m.label_file_tree_upload_folder()}
				onclick={() => handleFolderUpload()}
				class="h-7 w-7 hover:!bg-chat-action-hover"
				disabled={isModificationDisabled}
			>
				<FolderUp class="h-4 w-4" strokeWidth={1.25} />
			</ButtonWithTooltip>

			<!-- Download All -->
			<ButtonWithTooltip
				tooltip={m.label_file_tree_download_all()}
				onclick={() => {
					fileTreeState.downloadFile({
						path: fileTreeState.rootPath,
						name: "workspace",
						type: "dir",
					});
				}}
				class="h-7 w-7 hover:!bg-chat-action-hover"
				disabled={fileTreeState.loading}
			>
				<ArrowDownToLine class="h-4 w-4" strokeWidth={1.25} />
			</ButtonWithTooltip>
		</div>

		<!-- Narrow layout: show dropdown menu -->
		<div class="[@container(min-width:135px)]:hidden flex">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					<ButtonWithTooltip
						tooltip={m.common_actions()}
						class="h-7 w-7 hover:!bg-chat-action-hover"
						disabled={isModificationDisabled}
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="14"
							height="14"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<circle cx="12" cy="12" r="1" />
							<circle cx="12" cy="5" r="1" />
							<circle cx="12" cy="19" r="1" />
						</svg>
					</ButtonWithTooltip>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start">
					<!-- Create File -->
					<DropdownMenu.Item
						onclick={() => handleCreateFile()}
						disabled={isModificationDisabled}
					>
						<FilePlus class="mr-2 h-4 w-4" />
						<span>{m.label_file_tree_create_file()}</span>
					</DropdownMenu.Item>

					<!-- Create Folder -->
					<DropdownMenu.Item
						onclick={() => handleCreateFolder()}
						disabled={isModificationDisabled}
					>
						<FolderPlus class="mr-2 h-4 w-4" />
						<span>{m.label_file_tree_new_folder()}</span>
					</DropdownMenu.Item>

					<DropdownMenu.Separator />

					<!-- Upload File -->
					<DropdownMenu.Item
						onclick={() => triggerFileUpload()}
						disabled={isModificationDisabled}
					>
						<FileUp class="mr-2 h-4 w-4" />
						<span>{m.label_file_tree_upload_file()}</span>
					</DropdownMenu.Item>

					<!-- Upload Folder -->
					<DropdownMenu.Item
						onclick={() => handleFolderUpload()}
						disabled={isModificationDisabled}
					>
						<FolderUp class="mr-2 h-4 w-4" />
						<span>{m.label_file_tree_upload_folder()}</span>
					</DropdownMenu.Item>

					<DropdownMenu.Separator />

					<!-- Download All -->
					<DropdownMenu.Item
						onclick={() => {
							fileTreeState.downloadFile({
								path: fileTreeState.rootPath,
								name: "workspace",
								type: "dir",
							});
						}}
						disabled={fileTreeState.loading}
					>
						<ArrowDownToLine class="mr-2 h-4 w-4" />
						<span>{m.label_file_tree_download_all()}</span>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
		<input bind:this={fileInput} type="file" class="hidden" onchange={handleFileUpload} />

		<!-- Refresh Button (always visible) -->
		<ButtonWithTooltip
			tooltip={m.label_file_tree_refresh()}
			onclick={() => fileTreeState.refreshFileTree()}
			class="h-7 w-7 hover:!bg-chat-action-hover"
			disabled={fileTreeState.loading}
		>
			<RefreshCw
				strokeWidth={1.25}
				class={`h-4 w-4 ${fileTreeState.loading ? "animate-spin" : ""}`}
			/>
		</ButtonWithTooltip>
	</div>

	<!-- File List -->
	<ContextMenu.Root>
		<ContextMenu.Trigger class="flex-1 overflow-y-auto block">
			{#if fileTreeState.error}
				<div class="m-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
					{fileTreeState.error}
				</div>
			{/if}

			{#if fileTreeState.loading && fileTreeState.treeNodes.length === 0}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
				</div>
			{:else if fileTreeState.treeNodes.length === 0}
				<div class="py-8 text-center text-xs text-muted-foreground">
					{m.label_file_tree_empty()}
				</div>
			{:else}
				<div class="p-1">
					{#each fileTreeState.treeNodes as node (node.path)}
						{@render treeNodeItem(node)}
					{/each}
				</div>
			{/if}
		</ContextMenu.Trigger>
		{@render emptyAreaContextMenu()}
	</ContextMenu.Root>

	<!-- Rename Dialog -->
	<Dialog.Root
		bind:open={renameDialogOpen}
		onOpenChange={(open) => {
			if (!open && !renamingInProgress) {
				renamingPath = null;
				renameInputValue = "";
				renamingInProgress = false;
			}
		}}
	>
		<Dialog.Content class="min-w-[400px]">
			<Dialog.Header>
				<Dialog.Title>{m.title_button_rename()}</Dialog.Title>
				<Dialog.Description>
					{renamingNodeType === "dir"
						? m.text_description_rename_folder()
						: m.text_description_rename_file()}
				</Dialog.Description>
			</Dialog.Header>

			<Input
				bind:value={renameInputValue}
				class="border-border !bg-background"
				placeholder={m.placeholder_input_rename()}
				disabled={renamingInProgress}
				onkeydown={(e) => {
					if (e.key === "Enter" && !renamingInProgress) {
						confirmRename();
					} else if (e.key === "Escape" && !renamingInProgress) {
						renameDialogOpen = false;
						renamingPath = null;
						renameInputValue = "";
						renamingInProgress = false;
					}
				}}
			/>

			<Dialog.Footer class="flex sm:justify-between">
				<Button
					variant="secondary"
					onclick={() => {
						renameDialogOpen = false;
						renamingPath = null;
						renameInputValue = "";
						renamingInProgress = false;
					}}
					disabled={renamingInProgress}
				>
					{m.text_button_cancel()}
				</Button>
				<Button
					variant="default"
					onclick={confirmRename}
					disabled={renamingInProgress ||
						!renameInputValue.trim() ||
						!validateFileName(renameInputValue.trim())}
				>
					{#if renamingInProgress}
						<Loader2 class=" h-4 w-4 animate-spin" />
					{/if}
					{m.text_button_save()}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Create File Dialog -->
	<Dialog.Root
		bind:open={createFileDialogOpen}
		onOpenChange={(open) => {
			if (!open && !creatingFileInProgress) {
				createFilePath = null;
				createFileInputValue = "";
				creatingFileInProgress = false;
			}
		}}
	>
		<Dialog.Content class="min-w-[400px]">
			<Dialog.Header>
				<Dialog.Title>{m.title_button_create_file()}</Dialog.Title>
				<Dialog.Description>{m.text_description_create_file()}</Dialog.Description>
			</Dialog.Header>

			<Input
				bind:value={createFileInputValue}
				class="border-border !bg-background"
				placeholder={m.placeholder_input_create_file()}
				disabled={creatingFileInProgress}
				onkeydown={(e) => {
					if (e.key === "Enter" && !creatingFileInProgress) {
						confirmCreateFile();
					} else if (e.key === "Escape" && !creatingFileInProgress) {
						createFileDialogOpen = false;
						createFilePath = null;
						createFileInputValue = "";
						creatingFileInProgress = false;
					}
				}}
			/>

			<Dialog.Footer class="flex sm:justify-between">
				<Button
					variant="secondary"
					onclick={() => {
						createFileDialogOpen = false;
						createFilePath = null;
						createFileInputValue = "";
						creatingFileInProgress = false;
					}}
					disabled={creatingFileInProgress}
				>
					{m.text_button_cancel()}
				</Button>
				<Button
					variant="default"
					onclick={confirmCreateFile}
					disabled={creatingFileInProgress ||
						!createFileInputValue.trim() ||
						!validateFileName(createFileInputValue.trim())}
				>
					{#if creatingFileInProgress}
						<Loader2 class=" h-4 w-4 animate-spin" />
					{/if}
					{m.label_button_confirm()}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Create Folder Dialog -->
	<Dialog.Root
		bind:open={createFolderDialogOpen}
		onOpenChange={(open) => {
			if (!open && !createFolderInProgress) {
				createFolderParentPath = null;
				createFolderInputValue = "";
				createFolderInProgress = false;
			}
		}}
	>
		<Dialog.Content class="min-w-[400px]">
			<Dialog.Header>
				<Dialog.Title>{m.title_button_new_folder()}</Dialog.Title>
				<Dialog.Description>{m.text_description_new_folder()}</Dialog.Description>
			</Dialog.Header>

			<Input
				bind:value={createFolderInputValue}
				class="border-border !bg-background"
				placeholder={m.placeholder_input_folder_name()}
				disabled={createFolderInProgress}
				onkeydown={(e) => {
					if (e.key === "Enter" && !createFolderInProgress) {
						confirmCreateFolder();
					} else if (e.key === "Escape" && !createFolderInProgress) {
						createFolderDialogOpen = false;
						createFolderParentPath = null;
						createFolderInputValue = "";
						createFolderInProgress = false;
					}
				}}
			/>

			<Dialog.Footer class="flex sm:justify-between">
				<Button
					variant="secondary"
					onclick={() => {
						createFolderDialogOpen = false;
						createFolderParentPath = null;
						createFolderInputValue = "";
						createFolderInProgress = false;
					}}
					disabled={createFolderInProgress}
				>
					{m.text_button_cancel()}
				</Button>
				<Button
					variant="default"
					onclick={confirmCreateFolder}
					disabled={createFolderInProgress ||
						!createFolderInputValue.trim() ||
						!validateFileName(createFolderInputValue.trim())}
				>
					{#if createFolderInProgress}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					{m.text_button_create()}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<!-- Delete Confirmation Dialog -->
	<Dialog.Root
		bind:open={deleteDialogOpen}
		onOpenChange={(open) => {
			if (!open && !deletingInProgress) {
				deleteNode = null;
				deletingInProgress = false;
			}
		}}
	>
		<Dialog.Content class="min-w-[400px]">
			<Dialog.Header>
				<Dialog.Title>{m.title_confirm_delete()}</Dialog.Title>
				<Dialog.Description>
					{m.text_description_confirm_delete({ name: deleteNode?.name ?? "" })}
				</Dialog.Description>
			</Dialog.Header>

			<Dialog.Footer class="flex sm:justify-between">
				<Button
					variant="secondary"
					onclick={() => {
						deleteDialogOpen = false;
						deleteNode = null;
						deletingInProgress = false;
					}}
					disabled={deletingInProgress}
				>
					{m.text_button_cancel()}
				</Button>
				<Button variant="destructive" onclick={confirmDelete} disabled={deletingInProgress}>
					{#if deletingInProgress}
						<Loader2 class="h-4 w-4 animate-spin" />
					{/if}
					{m.text_button_delete()}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
</div>
