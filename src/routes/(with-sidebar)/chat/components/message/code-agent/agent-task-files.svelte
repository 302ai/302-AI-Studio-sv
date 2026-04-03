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
	import { getSandboxDownloadErrorMessage } from "$lib/utils/sandbox-download-error";
	import { Download, FileIcon } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	let { files }: Props = $props();

	let isDownloading = $state<Record<string, boolean>>({});
	const getFileName = (filePath: string) => filePath.split(/[/\\]/).filter(Boolean).pop() ?? "";
	const hasFileExtension = (filePath: string) => {
		const fileName = getFileName(filePath);
		const lastDotIndex = fileName.lastIndexOf(".");

		return lastDotIndex > 0 && lastDotIndex < fileName.length - 1;
	};
	let visibleFiles = $derived(files.filter(hasFileExtension));
	let fileItems = $derived(
		visibleFiles.map((file) => ({
			file,
			fileName: getFileName(file),
			downloading: Boolean(isDownloading[file]),
		})),
	);

	function handleDownloadClick(event: MouseEvent, filePath: string) {
		event.stopPropagation();
		handleDownloadFile(filePath);
	}

	async function handleDownloadFile(filePath: string) {
		if (isDownloading[filePath]) {
			return;
		}

		if (!claudeCodeAgentState.sandboxId) {
			toast.error(m.toast_download_failed());
			return;
		}

		try {
			isDownloading = { ...isDownloading, [filePath]: true };
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
			const filename = getFileName(filePath) || "download";

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
			logger.error("Failed to download file:", error);
			toast.error(getSandboxDownloadErrorMessage(error));
		} finally {
			// Reset to undefined by removing key to keep state map clean.
			const nextState = { ...isDownloading };
			delete nextState[filePath];
			isDownloading = nextState;
		}
	}
</script>

{#if fileItems.length > 0}
	<div class="mt-2 mb-3">
		<h4 class="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
			<FileIcon class="h-3 w-3" />
			{m.title_files()}
		</h4>
		<div class="flex flex-wrap gap-2">
			{#each fileItems as item (item.file)}
				<div
					class="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/30 hover:bg-muted/50 transition-colors"
				>
					<span class="text-xs truncate max-w-[200px]" title={item.file}
						>{item.fileName}</span
					>
					{#if item.downloading}
						<ButtonWithTooltip
							tooltipSide="top"
							class="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground shadow-none bg-transparent hover:!bg-transparent"
							variant="ghost"
							tooltip={m.export_button()}
							onclick={(e) => handleDownloadClick(e, item.file)}
						>
							<div
								class="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent"
							></div>
						</ButtonWithTooltip>
					{:else}
						<ButtonWithTooltip
							tooltipSide="top"
							class="h-5 w-5 p-0 shrink-0 text-muted-foreground hover:text-foreground shadow-none bg-transparent hover:!bg-transparent"
							variant="ghost"
							tooltip={m.export_button()}
							onclick={(e) => handleDownloadClick(e, item.file)}
						>
							<Download class="h-3 w-3" />
						</ButtonWithTooltip>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
