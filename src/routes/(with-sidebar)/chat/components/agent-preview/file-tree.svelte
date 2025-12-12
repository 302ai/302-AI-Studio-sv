<script lang="ts">
	import type { SandboxFileInfo } from "$lib/api/sandbox-file";
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Dialog from "$lib/components/ui/dialog";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
	import { Input } from "$lib/components/ui/input";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeAgentState } from "$lib/stores/code-agent";
	import {
		ArrowDownToLine,
		ArrowLeft,
		ChevronRight,
		File,
		FilePlus,
		FileUp,
		Folder,
		FolderPlus,
		FolderUp,
		Loader2,
		RefreshCw,
	} from "@lucide/svelte";
	import { onDestroy } from "svelte";
	import { toast } from "svelte-sonner";
	import { FileTreeState } from "./file-tree-state.svelte";

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

	// UI-specific state for rename dialog
	let renamingPath = $state<string | null>(null);
	let renameDialogOpen = $state(false);
	let renameInputValue = $state("");
	let renamingInProgress = $state(false);

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

	// Validate file name
	function validateFileName(name: string): boolean {
		if (!name || name.trim().length === 0) {
			return false;
		}
		// 不允许包含特殊字符：/ \ : * ? " < > |
		const invalidChars = /[/\\:*?"<>|]/;
		return !invalidChars.test(name);
	}

	// Handle file click
	function handleFileClick(file: SandboxFileInfo) {
		if (fileTreeState.selectedFile === file.path) return;
		fileTreeState.selectFile(file);
		onFileSelect?.(file);
	}

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

			// Auto select the new file
			handleFileClick(newFile);
		}
	}

	// Handle rename
	async function handleRename(file: SandboxFileInfo) {
		if (file.type === "dir") {
			return;
		}
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
		const success = await fileTreeState.renameFile(oldPath, newPath, newName);
		renamingInProgress = false;

		if (success) {
			renameDialogOpen = false;
			renamingPath = null;
			renameInputValue = "";
		}
	}

	// Handle delete
	async function handleDelete(file: SandboxFileInfo) {
		const success = await fileTreeState.deleteFile(file.path);
		if (success) {
			onFileDelete?.(file);
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
				wasEmpty && isNowValid && !hasLoadedWithWorkspacePath && !isLoadingFromStorage && sandboxId;

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
		const currentSessionId = claudeCodeAgentState.currentSessionId;
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
				(sandboxChanged && oldSandboxId !== undefined) || (sessionChanged && oldSessionId !== null);
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
			await fileTreeState.uploadFile(file, pendingUploadPath ?? fileTreeState.currentDirectory);

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

{#snippet flatListItem(file: SandboxFileInfo)}
	{@const isDir = file.type === "dir"}
	{@const isOperating = fileTreeState.operatingPaths.has(file.path)}
	{@const isDownloading = fileTreeState.downloadingPaths.has(file.path)}
	{@const isPasteOperating = fileTreeState.copiedFilePath
		? fileTreeState.operatingPaths.has(fileTreeState.copiedFilePath)
		: false}

	<ContextMenu.Root>
		<ContextMenu.Trigger>
			<button
				type="button"
				onclick={() => {
					if (isDir) {
						fileTreeState.navigateToDirectory(file.path);
					} else {
						handleFileClick(file);
					}
				}}
				class={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left hover:bg-muted transition-colors ${
					!isDir && fileTreeState.selectedFile === file.path ? "bg-muted" : ""
				}`}
			>
				<div class="flex items-center gap-2 flex-1 min-w-0">
					{#if isDir}
						{#if fileTreeState.loadingDirs.has(file.path)}
							<Loader2 class="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
						{:else}
							<Folder class="h-4 w-4 flex-shrink-0 text-blue-500" />
						{/if}
						<span class="truncate text-sm font-medium">{file.name}</span>
						<ChevronRight class="h-3 w-3 flex-shrink-0 text-muted-foreground ml-auto" />
					{:else}
						<File class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
						<span class="truncate text-sm">{file.name}</span>
					{/if}
				</div>
			</button>
		</ContextMenu.Trigger>
		<ContextMenu.Content>
			{#if !isDir}
				<ContextMenu.Item
					onSelect={() => handleRename(file)}
					disabled={isOperating || fileTreeState.isStreaming}
				>
					<span>{m.title_button_rename()}</span>
				</ContextMenu.Item>
			{/if}
			<ContextMenu.Item
				onSelect={() => handleCopy(file)}
				disabled={isOperating || fileTreeState.isStreaming}
			>
				<span>{m.common_copy()}</span>
			</ContextMenu.Item>
			{#if isDir}
				<ContextMenu.Item
					onSelect={() => handlePaste(file)}
					disabled={!fileTreeState.copiedFilePath || isPasteOperating || fileTreeState.isStreaming}
				>
					<span>{m.label_file_tree_paste()}</span>
				</ContextMenu.Item>
				<ContextMenu.Separator />
				<ContextMenu.Item
					onSelect={() => handleCreateFolder(file.path)}
					disabled={isOperating || fileTreeState.isStreaming}
				>
					<span>{m.label_file_tree_new_folder()}</span>
				</ContextMenu.Item>
				<ContextMenu.Item
					onSelect={() => handleCreateFile(file.path)}
					disabled={isOperating || fileTreeState.isStreaming}
				>
					<span>{m.label_file_tree_create_file()}</span>
				</ContextMenu.Item>
				<ContextMenu.Separator />
				<ContextMenu.Item
					onSelect={() => triggerFileUpload(file.path)}
					disabled={isOperating || fileTreeState.isStreaming}
				>
					<span>{m.label_file_tree_upload_file()}</span>
				</ContextMenu.Item>
				<ContextMenu.Item
					onSelect={() => handleFolderUpload(file.path)}
					disabled={isOperating || fileTreeState.isStreaming}
				>
					<span>{m.label_file_tree_upload_folder()}</span>
				</ContextMenu.Item>
			{/if}
			<ContextMenu.Separator />
			<ContextMenu.Item onSelect={() => handleDownload(file)} disabled={isDownloading}>
				<span>{m.label_file_tree_download()}</span>
			</ContextMenu.Item>
			{#if !isDir}
				<ContextMenu.Separator />
				<ContextMenu.Item
					onSelect={() => handleDelete(file)}
					disabled={isOperating || fileTreeState.isStreaming}
					class="text-destructive focus:text-destructive"
				>
					<span>{m.text_button_delete()}</span>
				</ContextMenu.Item>
			{/if}
		</ContextMenu.Content>
	</ContextMenu.Root>
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
			<button
				type="button"
				onclick={() => handleCreateFile()}
				class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.title_button_create_file()}
			>
				<FilePlus class="h-4 w-4" strokeWidth={1.25} />
			</button>

			<!-- Create Folder -->
			<button
				type="button"
				onclick={() => handleCreateFolder()}
				class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.title_button_new_folder()}
			>
				<FolderPlus class="h-4 w-4" strokeWidth={1.25} />
			</button>

			<!-- Upload File -->
			<button
				type="button"
				onclick={() => triggerFileUpload()}
				class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.label_file_tree_upload_file()}
			>
				<FileUp class="h-4 w-4" strokeWidth={1.25} />
			</button>

			<!-- Upload Folder -->
			<button
				type="button"
				onclick={() => handleFolderUpload()}
				class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.label_file_tree_upload_folder()}
			>
				<FolderUp class="h-4 w-4" strokeWidth={1.25} />
			</button>

			<button
				type="button"
				onclick={() => {
					fileTreeState.downloadFile({
						path: fileTreeState.rootPath,
						name: "workspace",
						type: "dir",
					});
				}}
				class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				disabled={fileTreeState.loading || fileTreeState.isStreaming}
				title={m.label_file_tree_download_all()}
			>
				<ArrowDownToLine class="h-4 w-4" strokeWidth={1.25} />
			</button>
		</div>

		<!-- Narrow layout: show dropdown menu -->
		<div class="[@container(min-width:135px)]:hidden flex">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					<button
						type="button"
						class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1"
						disabled={fileTreeState.loading || fileTreeState.isStreaming}
						title={m.common_actions()}
						aria-label={m.common_actions()}
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
					</button>
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="start">
					<!-- Create File -->
					<DropdownMenu.Item
						onclick={() => handleCreateFile()}
						disabled={fileTreeState.loading || fileTreeState.isStreaming}
					>
						<FilePlus class="mr-2 h-4 w-4" />
						<span>{m.label_file_tree_create_file()}</span>
					</DropdownMenu.Item>

					<!-- Create Folder -->
					<DropdownMenu.Item
						onclick={() => handleCreateFolder()}
						disabled={fileTreeState.loading || fileTreeState.isStreaming}
					>
						<FolderPlus class="mr-2 h-4 w-4" />
						<span>{m.label_file_tree_new_folder()}</span>
					</DropdownMenu.Item>

					<DropdownMenu.Separator />

					<!-- Upload File -->
					<DropdownMenu.Item
						onclick={() => triggerFileUpload()}
						disabled={fileTreeState.loading || fileTreeState.isStreaming}
					>
						<FileUp class="mr-2 h-4 w-4" />
						<span>{m.label_file_tree_upload_file()}</span>
					</DropdownMenu.Item>

					<!-- Upload Folder -->
					<DropdownMenu.Item
						onclick={() => handleFolderUpload()}
						disabled={fileTreeState.loading || fileTreeState.isStreaming}
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
						disabled={fileTreeState.loading || fileTreeState.isStreaming}
					>
						<ArrowDownToLine class="mr-2 h-4 w-4" />
						<span>{m.label_file_tree_download_all()}</span>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
		<input bind:this={fileInput} type="file" class="hidden" onchange={handleFileUpload} />

		<!-- Refresh Button (always visible) -->
		<button
			type="button"
			onclick={() => fileTreeState.refreshFileTree()}
			class="rounded p-1 disabled:cursor-not-allowed disabled:opacity-50 transition-colors hover:bg-accent hover:text-accent-foreground"
			disabled={fileTreeState.loading || fileTreeState.isStreaming}
			title={m.label_file_tree_refresh()}
		>
			<RefreshCw
				strokeWidth={1.25}
				class={`h-4 w-4 ${fileTreeState.loading ? "animate-spin" : ""}`}
			/>
		</button>
	</div>

	<!-- Navigation Bar with Back Button and Breadcrumb -->
	<div class="flex items-center gap-1 border-b border-border px-2 py-1.5 min-h-[32px]">
		<!-- Back Button -->
		<button
			type="button"
			onclick={() => fileTreeState.navigateBack()}
			class="rounded p-1 transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
			disabled={fileTreeState.isAtRoot || fileTreeState.loading || fileTreeState.isStreaming}
			title="Back"
		>
			<ArrowLeft class="h-3.5 w-3.5" strokeWidth={1.5} />
		</button>

		<!-- Breadcrumb -->
		<div class="flex items-center gap-0.5 flex-1 min-w-0 overflow-hidden">
			{#each fileTreeState.breadcrumbSegments as segment, index (segment.path)}
				{#if index > 0}
					<ChevronRight class="h-3 w-3 flex-shrink-0 text-muted-foreground" />
				{/if}
				{#if segment.isLast}
					<span class="truncate text-xs font-medium text-foreground">{segment.name}</span>
				{:else}
					<button
						type="button"
						onclick={() => fileTreeState.navigateToDirectory(segment.path)}
						class="truncate text-xs text-muted-foreground hover:text-foreground transition-colors"
					>
						{segment.name}
					</button>
				{/if}
			{/each}
		</div>
	</div>

	<!-- File List (Flat Navigation View) -->
	<div class="flex-1 overflow-y-auto">
		{#if fileTreeState.error}
			<div class="m-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
				{fileTreeState.error}
			</div>
		{/if}

		{#if fileTreeState.loading && fileTreeState.currentItems.length === 0}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
			</div>
		{:else if fileTreeState.currentItems.length === 0}
			<div class="py-8 text-center text-xs text-muted-foreground">{m.label_file_tree_empty()}</div>
		{:else}
			<div class="p-1">
				{#each fileTreeState.currentItems as file (file.path)}
					{@render flatListItem(file)}
				{/each}
			</div>
		{/if}
	</div>

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
				<Dialog.Description>{m.text_description_rename_file()}</Dialog.Description>
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
</div>
