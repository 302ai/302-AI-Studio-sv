<script lang="ts">
	import { listSandboxFiles, type SandboxFileInfo } from "$lib/api/sandbox-file";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { ChevronDown, ChevronRight, File, Folder, FolderOpen, Loader2 } from "@lucide/svelte";

	interface Props {
		sandboxId: string;
		onFileSelect?: (file: SandboxFileInfo) => void;
	}

	let { sandboxId, onFileSelect }: Props = $props();

	let files = $state<SandboxFileInfo[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let expandedDirs = $state<Set<string>>(new Set());
	let selectedFile = $state<string | null>(null);

	// 获取 302.AI provider 的 API key
	const get302ApiKey = () => {
		const provider = persistedProviderState.current.find((p) => p.name === "302.AI" && p.enabled);
		return provider?.apiKey || "";
	};

	// 加载文件列表
	async function loadFiles(path: string = "/home/user/workspace") {
		if (!sandboxId) {
			console.log("[FileTree] No sandboxId provided");
			return;
		}

		loading = true;
		error = null;
		console.log("[FileTree] Loading files for sandbox:", sandboxId, "path:", path);

		try {
			const apiKey = get302ApiKey();
			if (!apiKey) {
				error = "302.AI API key not found";
				console.error("[FileTree]", error);
				return;
			}

			console.log("[FileTree] Using API key:", apiKey.substring(0, 10) + "...");
			const response = await listSandboxFiles(sandboxId, path, apiKey);
			console.log("[FileTree] Response:", response);

			if (response.success && response.filelist) {
				files = response.filelist;
				console.log("[FileTree] Loaded files:", files.length);
			} else {
				console.log("[FileTree] No files in response");
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to load files";
			console.error("[FileTree] Failed to load sandbox files:", e);
		} finally {
			loading = false;
		}
	}

	// 切换文件夹展开状态
	function toggleDir(path: string) {
		if (expandedDirs.has(path)) {
			expandedDirs.delete(path);
		} else {
			expandedDirs.add(path);
		}
		expandedDirs = new Set(expandedDirs);
	}

	// 选择文件
	function handleFileClick(file: SandboxFileInfo) {
		if (file.type === "file") {
			selectedFile = file.path;
			onFileSelect?.(file);
		}
	}

	// 初始加载
	$effect(() => {
		if (sandboxId) {
			loadFiles();
		}
	});
</script>

<div class="flex h-full flex-col bg-background">
	<!-- Header -->
	<div class="flex items-center justify-between border-b border-border px-3 py-2">
		<h3 class="text-xs font-semibold uppercase text-muted-foreground">Files</h3>
		<button
			type="button"
			onclick={() => loadFiles()}
			class="rounded p-1 hover:bg-muted"
			disabled={loading}
			title="Refresh"
		>
			<Loader2 class={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
		</button>
	</div>

	<!-- File List -->
	<div class="flex-1 overflow-y-auto">
		{#if error}
			<div class="m-2 rounded bg-destructive/10 p-2 text-xs text-destructive">
				{error}
			</div>
		{/if}

		{#if loading && files.length === 0}
			<div class="flex items-center justify-center py-8">
				<Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
			</div>
		{:else if files.length === 0}
			<div class="py-8 text-center text-xs text-muted-foreground">No files found</div>
		{:else}
			<div class="p-1">
				{#each files as file}
					{#if file.type === "dir"}
						<button
							type="button"
							onclick={() => toggleDir(file.path)}
							class="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left hover:bg-muted"
						>
							{#if expandedDirs.has(file.path)}
								<ChevronDown class="h-3 w-3 flex-shrink-0 text-muted-foreground" />
								<FolderOpen class="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
							{:else}
								<ChevronRight class="h-3 w-3 flex-shrink-0 text-muted-foreground" />
								<Folder class="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
							{/if}
							<span class="truncate text-xs">{file.name}</span>
						</button>
					{:else}
						<button
							type="button"
							onclick={() => handleFileClick(file)}
							class={`flex w-full items-center gap-1.5 rounded px-2 py-1 pl-7 text-left hover:bg-muted ${
								selectedFile === file.path ? "bg-muted" : ""
							}`}
						>
							<File class="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
							<span class="truncate text-xs">{file.name}</span>
						</button>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>

