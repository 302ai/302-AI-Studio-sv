<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import Input from "$lib/components/ui/input/input.svelte";
	import * as Popover from "$lib/components/ui/popover";
	import { ScrollArea } from "$lib/components/ui/scroll-area";
	import { m } from "$lib/paraglide/messages";
	import { FilePlus, FolderPlus } from "@lucide/svelte";
	import type { FileNode } from "@shared/types";
	import { tick } from "svelte";
	import { SvelteSet } from "svelte/reactivity";
	import FileNameDialog from "./file-name-dialog.svelte";
	import SkillFileTreeNode from "./skill-file-tree-node.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	type DialogMode = "create-file" | "create-folder" | "rename";

	interface Props {
		rootPath: string;
		readOnly?: boolean;
		defaultExpandAll?: boolean;
		autoSelectPriority?: string[]; // File names to auto-select by priority
		onSelect?: (file: { path: string; content: string }) => void;
		onRootPathChange?: (newRootPath: string) => void; // Notify when root directory is renamed
		onFileRename?: (oldPath: string, newPath: string) => void; // Notify when file/folder is renamed
	}

	// Default priority for auto-selecting files
	const DEFAULT_AUTO_SELECT_PRIORITY = [
		"SKILL.md",
		"skill.md",
		"README.md",
		"readme.md",
		"index.md",
		"INDEX.md",
	];

	let {
		rootPath,
		readOnly = false,
		defaultExpandAll = false,
		autoSelectPriority = DEFAULT_AUTO_SELECT_PRIORITY,
		onSelect,
		onRootPathChange,
		onFileRename,
	}: Props = $props();
	let tree = $state<FileNode | null>(null);
	let selectedPath = $state("");
	let loading = $state(false);

	// Track expanded folders - persists across tree refreshes
	let expandedPaths = new SvelteSet<string>();

	// Dialog states
	let nameDialogOpen = $state(false);
	let nameDialogMode = $state<DialogMode>("create-file");
	let nameDialogInitialValue = $state("");
	let targetPath = $state("");
	let _targetNode = $state<FileNode | null>(null);

	// Delete confirmation dialog
	let deleteDialogOpen = $state(false);
	let deleteNode = $state<FileNode | null>(null);

	// Global create popover state (for empty area right-click)
	type GlobalPopoverMode = "none" | "create-file" | "create-folder";
	let globalPopoverMode = $state<GlobalPopoverMode>("none");
	let globalPopoverValue = $state("");
	let globalPopoverInputRef = $state<HTMLInputElement | null>(null);
	let isGlobalPopoverOpen = $derived(globalPopoverMode !== "none");
	// Mouse position for popover positioning
	let mouseX = $state(0);
	let mouseY = $state(0);
	let popoverAnchorRef = $state<HTMLDivElement | null>(null);

	const {
		scanDirectory,
		readFile,
		writeFile,
		createDirectory,
		deleteFile,
		deleteDirectory,
		renameFile,
	} = window.electronAPI.appService;

	// Collect all directory paths for expanding
	function collectAllDirectoryPaths(node: FileNode, paths: string[] = []): string[] {
		if (node.type === "directory") {
			paths.push(node.path);
			node.children?.forEach((child) => collectAllDirectoryPaths(child, paths));
		}
		return paths;
	}

	// Find file by priority from the file tree
	function findFileByPriority(node: FileNode, priority: string[]): FileNode | null {
		const allFiles: FileNode[] = [];

		function collectFiles(n: FileNode) {
			if (n.type === "file") {
				allFiles.push(n);
			}
			n.children?.forEach(collectFiles);
		}

		collectFiles(node);

		// Find first matching file by priority
		for (const name of priority) {
			const found = allFiles.find(
				(f) => f.name.toLowerCase() === name.toLowerCase() || f.name === name,
			);
			if (found) return found;
		}

		return null;
	}

	let hasInitialized = false;

	async function loadTree(path: string) {
		if (!path) return;
		loading = true;
		try {
			tree = await scanDirectory(path);

			// Only run initialization once
			if (tree && !hasInitialized) {
				hasInitialized = true;

				// Expand all directories if enabled
				if (defaultExpandAll) {
					const allDirs = collectAllDirectoryPaths(tree);
					allDirs.forEach((dir) => expandedPaths.add(dir));
				}

				// Auto-select priority file
				if (autoSelectPriority.length > 0) {
					const priorityFile = findFileByPriority(tree, autoSelectPriority);
					if (priorityFile) {
						handleNodeSelect(priorityFile);
					}
				}
			}
		} catch (error) {
			logger.error("Failed to scan directory:", error);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadTree(rootPath);
	});

	async function handleNodeSelect(node: FileNode) {
		selectedPath = node.path;
		if (node.type === "file") {
			try {
				const content = await readFile(node.path);
				onSelect?.({ path: node.path, content });
			} catch (error) {
				logger.error("Failed to read file:", error);
			}
		}
	}

	async function handleCreateFileConfirm(parentPath: string, fileName: string) {
		try {
			const filePath = joinPath(parentPath, fileName);
			await writeFile(filePath, "");
			// Ensure parent folder is expanded after creation
			expandedPaths.add(parentPath);
			// Auto-select the new file
			await loadTree(rootPath);
			selectedPath = filePath;
			onSelect?.({ path: filePath, content: "" });
		} catch (error) {
			logger.error("Create file failed:", error);
		}
	}

	async function handleCreateFolderConfirm(parentPath: string, folderName: string) {
		try {
			const folderPath = joinPath(parentPath, folderName);
			await createDirectory(folderPath);
			// Ensure parent folder is expanded after creation
			expandedPaths.add(parentPath);
			// Refresh tree
			await loadTree(rootPath);
		} catch (error) {
			logger.error("Create folder failed:", error);
		}
	}

	async function handleRenameConfirm(node: FileNode, newName: string) {
		try {
			const parentPath = getParentPath(node.path);
			const newPath = joinPath(parentPath, newName);
			const oldPath = node.path;
			await renameFile(oldPath, newPath);

			// Check if we're renaming the root directory
			if (oldPath === rootPath) {
				onRootPathChange?.(newPath);
			} else {
				// Notify about file/folder rename
				onFileRename?.(oldPath, newPath);
				await loadTree(rootPath);
			}
		} catch (error) {
			logger.error("Rename failed:", error);
		}
	}

	function handleDelete(node: FileNode) {
		deleteNode = node;
		deleteDialogOpen = true;
	}

	function handleToggleExpand(path: string, expanded: boolean) {
		if (expanded) {
			expandedPaths.add(path);
		} else {
			expandedPaths.delete(path);
		}
	}

	async function confirmNameDialog(name: string) {
		try {
			if (nameDialogMode === "create-file") {
				const filePath = joinPath(targetPath, name);
				await writeFile(filePath, "");
				// Ensure parent folder is expanded after creation
				expandedPaths.add(targetPath);
				// Auto-select the new file
				await loadTree(rootPath);
				selectedPath = filePath;
				onSelect?.({ path: filePath, content: "" });
				return;
			} else if (nameDialogMode === "create-folder") {
				const folderPath = joinPath(targetPath, name);
				await createDirectory(folderPath);
				// Ensure parent folder is expanded after creation
				expandedPaths.add(targetPath);
			}
			// Refresh tree
			await loadTree(rootPath);
		} catch (error) {
			logger.error("File operation failed:", error);
		}
	}

	async function confirmDelete() {
		if (!deleteNode) return;
		try {
			if (deleteNode.type === "directory") {
				await deleteDirectory(deleteNode.path);
			} else {
				await deleteFile(deleteNode.path);
			}
			deleteDialogOpen = false;
			deleteNode = null;
			// Refresh tree
			await loadTree(rootPath);
		} catch (error) {
			logger.error("Delete failed:", error);
		}
	}

	function joinPath(base: string, name: string): string {
		// Handle both Windows and Unix paths
		const separator = base.includes("\\") ? "\\" : "/";
		return base.endsWith(separator) ? base + name : base + separator + name;
	}

	function getParentPath(path: string): string {
		const separator = path.includes("\\") ? "\\" : "/";
		const parts = path.split(separator);
		parts.pop();
		return parts.join(separator);
	}

	// Capture mouse position on context menu
	function handleContextMenu(e: MouseEvent) {
		mouseX = e.clientX;
		mouseY = e.clientY;
		// Update anchor position
		if (popoverAnchorRef) {
			popoverAnchorRef.style.left = `${mouseX}px`;
			popoverAnchorRef.style.top = `${mouseY}px`;
		}
	}

	// Global popover handlers (for empty area right-click)
	async function handleGlobalCreateFile() {
		globalPopoverValue = "";
		await new Promise((resolve) => setTimeout(resolve, 100));
		globalPopoverMode = "create-file";
		await tick();
		globalPopoverInputRef?.focus();
	}

	async function handleGlobalCreateFolder() {
		globalPopoverValue = "";
		await new Promise((resolve) => setTimeout(resolve, 100));
		globalPopoverMode = "create-folder";
		await tick();
		globalPopoverInputRef?.focus();
	}

	function closeGlobalPopover() {
		globalPopoverMode = "none";
		globalPopoverValue = "";
	}

	async function confirmGlobalPopover() {
		const trimmed = globalPopoverValue.trim();
		if (!trimmed) {
			closeGlobalPopover();
			return;
		}

		// Create in root directory
		if (globalPopoverMode === "create-file") {
			await handleCreateFileConfirm(rootPath, trimmed);
		} else if (globalPopoverMode === "create-folder") {
			await handleCreateFolderConfirm(rootPath, trimmed);
		}
		closeGlobalPopover();
	}

	function handleGlobalPopoverKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") {
			e.preventDefault();
			confirmGlobalPopover();
		} else if (e.key === "Escape") {
			e.preventDefault();
			closeGlobalPopover();
		}
	}

	function getGlobalPopoverTitle(): string {
		switch (globalPopoverMode) {
			case "create-file":
				return m.file_tree_new_file();
			case "create-folder":
				return m.file_tree_new_folder();
			default:
				return "";
		}
	}

	function handleGlobalPopoverOpenChange(open: boolean) {
		if (!open) {
			closeGlobalPopover();
		}
	}
</script>

{#if readOnly}
	<div class="h-full w-full bg-background">
		<ScrollArea class="h-full">
			<div class="p-2">
				{#if loading}
					<div class="p-2 text-sm text-muted-foreground">Loading...</div>
				{:else if tree}
					<SkillFileTreeNode
						node={tree}
						{selectedPath}
						{expandedPaths}
						{readOnly}
						onSelect={handleNodeSelect}
						onCreateFileConfirm={handleCreateFileConfirm}
						onCreateFolderConfirm={handleCreateFolderConfirm}
						onRenameConfirm={handleRenameConfirm}
						onDelete={handleDelete}
						onToggleExpand={handleToggleExpand}
					/>
				{:else}
					<div class="p-2 text-sm text-muted-foreground">No files found</div>
				{/if}
			</div>
		</ScrollArea>
	</div>
{:else}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="relative h-full w-full" oncontextmenu={handleContextMenu}>
		<ContextMenu.Root>
			<ContextMenu.Trigger class="h-full w-full">
				<div class="h-full w-full bg-background">
					<ScrollArea class="h-full">
						<div class="p-2">
							{#if loading}
								<div class="p-2 text-sm text-muted-foreground">Loading...</div>
							{:else if tree}
								<SkillFileTreeNode
									node={tree}
									{selectedPath}
									{expandedPaths}
									{readOnly}
									onSelect={handleNodeSelect}
									onCreateFileConfirm={handleCreateFileConfirm}
									onCreateFolderConfirm={handleCreateFolderConfirm}
									onRenameConfirm={handleRenameConfirm}
									onDelete={handleDelete}
									onToggleExpand={handleToggleExpand}
								/>
							{:else}
								<div class="p-2 text-sm text-muted-foreground">No files found</div>
							{/if}
						</div>
					</ScrollArea>
				</div>
			</ContextMenu.Trigger>
			<ContextMenu.Content class="w-48">
				<ContextMenu.Item onclick={handleGlobalCreateFile}>
					<FilePlus class="mr-2 h-4 w-4" />
					{m.file_tree_new_file()}
				</ContextMenu.Item>
				<ContextMenu.Item onclick={handleGlobalCreateFolder}>
					<FolderPlus class="mr-2 h-4 w-4" />
					{m.file_tree_new_folder()}
				</ContextMenu.Item>
			</ContextMenu.Content>
		</ContextMenu.Root>

		<!-- Virtual anchor for popover positioning -->
		<Popover.Root open={isGlobalPopoverOpen} onOpenChange={handleGlobalPopoverOpenChange}>
			<Popover.Trigger class="pointer-events-none">
				{#snippet child({ props })}
					<div
						{...props}
						bind:this={popoverAnchorRef}
						class="pointer-events-none fixed h-0 w-0"
						style="left: {mouseX}px; top: {mouseY}px;"
					></div>
				{/snippet}
			</Popover.Trigger>
			<Popover.Content class="w-64 p-3" align="start" side="bottom">
				<div class="flex flex-col gap-3">
					<span class="text-xs text-muted-foreground">{getGlobalPopoverTitle()}</span>
					<Input
						bind:ref={globalPopoverInputRef}
						bind:value={globalPopoverValue}
						placeholder={m.file_tree_name_placeholder()}
						class="h-8 dark:border-[#3d3d3d]"
						onkeydown={handleGlobalPopoverKeydown}
					/>
					<div class="flex justify-end gap-2">
						<Button variant="ghost" size="sm" onclick={closeGlobalPopover}>
							{m.common_cancel()}
						</Button>
						<Button size="sm" onclick={confirmGlobalPopover}>
							{m.text_button_confirm()}
						</Button>
					</div>
				</div>
			</Popover.Content>
		</Popover.Root>
	</div>
{/if}

<!-- Name Input Dialog -->
<FileNameDialog
	bind:open={nameDialogOpen}
	mode={nameDialogMode}
	initialValue={nameDialogInitialValue}
	onConfirm={confirmNameDialog}
	onCancel={() => {}}
/>

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.file_tree_delete()}</Dialog.Title>
		</Dialog.Header>
		<Dialog.Description>
			{deleteNode?.type === "directory"
				? m.file_tree_confirm_delete_folder()
				: m.file_tree_confirm_delete()}
		</Dialog.Description>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)}>
				{m.common_cancel()}
			</Button>
			<Button variant="destructive" onclick={confirmDelete}>
				{m.file_tree_delete()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
