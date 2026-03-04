<script lang="ts" module>
	export interface Props {
		files: string[];
	}
</script>

<script lang="ts">
	import { downloadSandboxFile } from "$lib/api/sandbox-file";
	import { ButtonWithTooltip } from "$lib/components/buss/button-with-tooltip";
	import { m } from "$lib/paraglide/messages";
	import { claudeCodeAgentState } from "$lib/stores/code-agent/claude-code-state.svelte";
	import { Download, FileIcon } from "@lucide/svelte";
	import { toast } from "svelte-sonner";

	let { files }: Props = $props();

	let isDownloading = $state<Record<string, boolean>>({});
	// Force re-render key - incremented when download state changes to workaround Svelte 5 reactivity issue
	let renderKey = $state(0);

	async function handleDownloadFile(filePath: string) {
		if (!claudeCodeAgentState.sandboxId) {
			toast.error(m.toast_download_failed());
			return;
		}

		try {
			isDownloading = { ...isDownloading, [filePath]: true };
			renderKey++; // Force re-render
			const response = await downloadSandboxFile(claudeCodeAgentState.sandboxId, filePath);

			// Handle direct content / Blob
			let blob: Blob;
			if (response._blobContent) {
				blob = response._blobContent;
			} else if (response._directContent) {
				blob = new Blob([response._directContent], {
					type: response._contentType || "text/plain",
				});
			} else {
				throw new Error("No file content received");
			}

			// Extract filename from path
			const filename = filePath.split("/").pop() || "download";

			// Create download link
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			toast.success(m.toast_download_file_success({ fileName: filename }));
		} catch (error) {
			console.error("Failed to download file:", error);
			toast.error(m.toast_download_failed());
		} finally {
			isDownloading = { ...isDownloading, [filePath]: false };
			renderKey++; // Force re-render
		}
	}
</script>

{#if files && files.length > 0}
	<div class="mt-2 mb-3">
		<h4 class="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
			<FileIcon class="h-3 w-3" />
			{m.title_files()}
		</h4>
		<div class="flex flex-wrap gap-2">
			{#each files as file (file + renderKey)}
				{@const isFileDownloading = isDownloading[file]}
				<div
					class="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/30 hover:bg-muted/50 transition-colors"
				>
					<span class="text-xs truncate max-w-[200px]" title={file}>{file.split("/").pop()}</span>
					<ButtonWithTooltip
						tooltipSide="top"
						class="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground shadow-none bg-transparent hover:!bg-transparent"
						variant="ghost"
						tooltip={m.export_button()}
						disabled={isFileDownloading}
						onclick={(e) => {
							e.stopPropagation();
							handleDownloadFile(file);
						}}
					>
						{#if isFileDownloading}
							<div
								class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
							></div>
						{:else}
							<Download class="h-3 w-3" />
						{/if}
					</ButtonWithTooltip>
				</div>
			{/each}
		</div>
	</div>
{/if}
