<script lang="ts">
	import CodeMirrorEditor from "$lib/components/buss/editor/codemirror-editor.svelte";
	import * as Resizable from "$lib/components/ui/resizable";
	import { m } from "$lib/paraglide/messages.js";
	import { FileDown } from "@lucide/svelte";
	import { mode } from "mode-watcher";
	import { onDestroy } from "svelte";
	import SkillFileTree from "./skill-file-tree.svelte";

	interface Props {
		rootPath: string;
		readOnly?: boolean;
		lineWrapping?: boolean;
		defaultExpandAll?: boolean;
		autoSelectPriority?: string[];
		changedFiles?: Map<string, string>; // 已修改的文件内容
		onFileChange?: (path: string, content: string) => void;
		onRootPathChange?: (newRootPath: string) => void; // 根目录重命名时通知父组件
		onFileRename?: (oldPath: string, newPath: string) => void; // 文件/文件夹重命名时通知父组件
	}

	let {
		rootPath,
		readOnly = true,
		lineWrapping = true,
		defaultExpandAll = false,
		autoSelectPriority,
		changedFiles,
		onFileChange,
		onRootPathChange,
		onFileRename,
	}: Props = $props();
	let fileContent = $state("");
	let filePath = $state("");
	let documentUrl = $state<string | null>(null);

	// Check if file is a PDF
	let isPdf = $derived(filePath.toLowerCase().endsWith(".pdf"));

	// Check if file is an Office document
	let isOfficeDocument = $derived(() => {
		const lowerPath = filePath.toLowerCase();
		return (
			lowerPath.endsWith(".xlsx") ||
			lowerPath.endsWith(".xls") ||
			lowerPath.endsWith(".docx") ||
			lowerPath.endsWith(".doc") ||
			lowerPath.endsWith(".pptx") ||
			lowerPath.endsWith(".ppt")
		);
	});

	// Check if file is a document type (PDF or Office)
	let isDocument = $derived(isPdf || isOfficeDocument());

	const { readFileAsBuffer } = window.electronAPI.appService;

	// Load document URL for PDF/Office files
	async function loadDocumentUrl(path: string) {
		if (documentUrl) {
			URL.revokeObjectURL(documentUrl);
			documentUrl = null;
		}

		try {
			const buffer = await readFileAsBuffer(path);
			const mimeType = isPdf ? "application/pdf" : "application/octet-stream";
			const blob = new Blob([buffer], { type: mimeType });
			documentUrl = URL.createObjectURL(blob);
		} catch (error) {
			console.error("Failed to load document:", error);
			documentUrl = null;
		}
	}

	function handleFileSelect(file: { path: string; content: string }) {
		filePath = file.path;

		// For document files, load as binary
		if (file.path.toLowerCase().endsWith(".pdf") || isOfficeDocumentPath(file.path)) {
			loadDocumentUrl(file.path);
			fileContent = "";
		} else {
			// 优先使用 changedFiles 中的内容（支持从默认视图切换过来时显示已修改的内容）
			const modifiedContent = changedFiles?.get(file.path);
			fileContent = modifiedContent !== undefined ? modifiedContent : file.content;
		}
	}

	function isOfficeDocumentPath(path: string): boolean {
		const lowerPath = path.toLowerCase();
		return (
			lowerPath.endsWith(".xlsx") ||
			lowerPath.endsWith(".xls") ||
			lowerPath.endsWith(".docx") ||
			lowerPath.endsWith(".doc") ||
			lowerPath.endsWith(".pptx") ||
			lowerPath.endsWith(".ppt")
		);
	}

	function handleContentChange(newContent: string) {
		fileContent = newContent;
		if (filePath && onFileChange) {
			onFileChange(filePath, newContent);
		}
	}

	function handleDownload() {
		if (!documentUrl) return;
		const link = document.createElement("a");
		link.href = documentUrl;
		link.download = filePath.split(/[/\\]/).pop() || "document";
		link.click();
	}

	// 监听 changedFiles 中当前选中文件的内容变化（form → 文件树联动）
	$effect(() => {
		if (filePath && changedFiles && !isDocument) {
			const modifiedContent = changedFiles.get(filePath);
			if (modifiedContent !== undefined && modifiedContent !== fileContent) {
				fileContent = modifiedContent;
			}
		}
	});

	// Cleanup blob URL on destroy
	onDestroy(() => {
		if (documentUrl) {
			URL.revokeObjectURL(documentUrl);
		}
	});

	// Determine language from file extension
	let language = $derived(filePath.split(".").pop() || "txt");
</script>

<div class="h-full w-full">
	<Resizable.PaneGroup direction="horizontal" class="h-full w-full rounded-lg border">
		<Resizable.Pane defaultSize={25} minSize={15} maxSize={40}>
			<div class="h-full">
				<SkillFileTree
					{rootPath}
					{readOnly}
					{defaultExpandAll}
					{autoSelectPriority}
					onSelect={handleFileSelect}
					{onRootPathChange}
					{onFileRename}
				/>
			</div>
		</Resizable.Pane>
		<Resizable.Handle />
		<Resizable.Pane defaultSize={75}>
			<div class="h-full border-l bg-background">
				{#if filePath}
					{#if isPdf && documentUrl}
						<!-- PDF preview using iframe -->
						<iframe
							src={documentUrl}
							title={filePath}
							class="h-full w-full border-0"
							style="background: white;"
						></iframe>
					{:else if isOfficeDocument() && documentUrl}
						<!-- Office documents cannot be displayed directly, show download option -->
						<div class="flex h-full flex-col items-center justify-center gap-4 p-8">
							<div class="text-muted-foreground text-center">
								<p class="mb-2 text-lg font-medium">
									{m.document_viewer_cannot_preview()}
								</p>
								<p class="text-sm">{m.document_viewer_download_instruction()}</p>
							</div>
							<button
								onclick={handleDownload}
								class="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-md px-4 py-2 transition-colors"
							>
								<FileDown class="h-4 w-4" />
								<span>{m.document_viewer_download_button()}</span>
							</button>
							<div class="text-muted-foreground mt-4 text-xs">
								<p>
									{m.document_viewer_filename()}: {filePath.split(/[/\\]/).pop()}
								</p>
							</div>
						</div>
					{:else if isDocument}
						<!-- Loading document -->
						<div class="flex h-full items-center justify-center">
							<p class="text-muted-foreground">{m.document_viewer_loading()}</p>
						</div>
					{:else}
						<CodeMirrorEditor
							value={fileContent}
							{language}
							theme={mode.current === "dark" ? "dark" : "light"}
							{readOnly}
							{lineWrapping}
							onChange={handleContentChange}
						/>
					{/if}
				{:else}
					<div class="flex h-full items-center justify-center text-muted-foreground">
						Select a file to view content
					</div>
				{/if}
			</div>
		</Resizable.Pane>
	</Resizable.PaneGroup>
</div>
