<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import { Loader2, Upload } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { SvelteMap } from "svelte/reactivity";
	import { getFrontMatterText, parseSkillFrontMatter } from "./skill-frontmatter";
	import SkillManualForm from "./skill-manual-form.svelte";

	interface SkillUploadData {
		skillRootDir: string;
		formData: {
			name: string;
			description: string;
			content: string;
		};
		changedFiles: Map<string, string>;
	}

	type UploadState = "idle" | "extracting" | "ready" | "error";

	let uploadState = $state<UploadState>("idle");
	let extractedPath = $state("");
	let skillRootDir = $state("");
	let skillMdFilePath = $state("");
	let errorMessage = $state("");
	let changedFiles = $state<Map<string, string>>(new Map());
	let formData = $state({
		name: "",
		description: "",
		content: "",
	});
	let manualFormRef = $state<SkillManualForm | undefined>();
	let fileInputRef = $state<HTMLInputElement | undefined>();

	const { extractZipBlob, scanDirectory, readFile, writeFile } = window.electronAPI.appService;

	// Find ALL SKILL.md files recursively (to detect multiple skills)
	function findAllSkillMd(
		node: { name: string; path: string; children?: unknown[] },
		results: string[] = [],
	): string[] {
		if (node.name === "SKILL.md") {
			results.push(node.path);
		}
		if (node.children) {
			for (const child of node.children as (typeof node)[]) {
				findAllSkillMd(child, results);
			}
		}
		return results;
	}

	// Get SKILL.md parent directory as skill root
	function getSkillRootDir(skillMdPath: string): string {
		return skillMdPath.replace(/[/\\]SKILL\.md$/i, "");
	}

	// Handle file drop or select
	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file.name.toLowerCase().endsWith(".zip")) {
			toast.error(m.skills_upload_invalid_file());
			return;
		}

		uploadState = "extracting";
		errorMessage = "";

		try {
			const arrayBuffer = await file.arrayBuffer();
			extractedPath = await extractZipBlob(arrayBuffer, file.name);

			// Scan and find ALL SKILL.md files
			const tree = await scanDirectory(extractedPath);
			const skillMdPaths = findAllSkillMd(tree);

			if (skillMdPaths.length === 0) {
				uploadState = "error";
				errorMessage = m.skills_upload_no_skill_found();
				return;
			}

			if (skillMdPaths.length > 1) {
				uploadState = "error";
				errorMessage = m.skills_upload_multiple_skills_found();
				return;
			}

			const skillMdPath = skillMdPaths[0];
			skillRootDir = getSkillRootDir(skillMdPath);
			skillMdFilePath = skillMdPath;

			// Read and parse SKILL.md
			const content = await readFile(skillMdPath);
			const parsed = parseSkillFrontMatter(content);
			formData = {
				name: getFrontMatterText(parsed.data, "name") || "",
				description: getFrontMatterText(parsed.data, "description") || "",
				content: content,
			};

			uploadState = "ready";
		} catch (error) {
			console.error("Failed to extract ZIP:", error);
			uploadState = "error";
			errorMessage = m.skills_create_failed();
		}
	}

	// Handle file content change from file tree
	function handleFileChange(path: string, content: string) {
		const newMap = new SvelteMap(changedFiles);
		newMap.set(path, content);
		changedFiles = newMap;

		// Sync SKILL.md content to formData
		if (path === skillMdFilePath) {
			formData.content = content;
		}
	}

	// Handle file/folder rename
	function handleFileRename(oldPath: string, newPath: string) {
		// 更新 changedFiles 中的路径
		const newMap = new SvelteMap<string, string>();
		for (const [path, content] of changedFiles) {
			if (path === oldPath) {
				newMap.set(newPath, content);
			} else if (path.startsWith(oldPath + "/") || path.startsWith(oldPath + "\\")) {
				// 处理文件夹重命名时，更新其下所有文件的路径
				const newFilePath = path.replace(oldPath, newPath);
				newMap.set(newFilePath, content);
			} else {
				newMap.set(path, content);
			}
		}
		changedFiles = newMap;

		// 如果重命名的是 SKILL.md，更新 skillMdFilePath
		if (oldPath === skillMdFilePath) {
			skillMdFilePath = newPath;
		} else if (
			skillMdFilePath.startsWith(oldPath + "/") ||
			skillMdFilePath.startsWith(oldPath + "\\")
		) {
			skillMdFilePath = skillMdFilePath.replace(oldPath, newPath);
		}
	}

	// Handle root path change (when root folder is renamed)
	function handleRootPathChange(newRootPath: string) {
		const oldRootPath = skillRootDir;

		// Update skillMdFilePath
		if (skillMdFilePath) {
			const newSkillMdPath = skillMdFilePath.replace(oldRootPath, newRootPath);
			// Update changedFiles paths
			const newMap = new SvelteMap<string, string>();
			for (const [path, content] of changedFiles) {
				const newPath = path.startsWith(oldRootPath)
					? path.replace(oldRootPath, newRootPath)
					: path;
				newMap.set(newPath, content);
			}
			changedFiles = newMap;
			skillMdFilePath = newSkillMdPath;
		}

		skillRootDir = newRootPath;
	}

	function handleClick() {
		fileInputRef?.click();
	}

	function handleFileInputChange(event: Event) {
		const input = event.target as HTMLInputElement;
		handleFiles(input.files);
		// Reset input so the same file can be selected again
		input.value = "";
	}

	// Sync formData.content changes to changedFiles for SKILL.md
	let prevFormContent = $state("");
	$effect(() => {
		if (skillMdFilePath && formData.content !== prevFormContent) {
			const newMap = new SvelteMap(changedFiles);
			newMap.set(skillMdFilePath, formData.content);
			changedFiles = newMap;
			prevFormContent = formData.content;
		}
	});

	// Exported methods
	export function validate(): boolean {
		if (uploadState !== "ready") {
			toast.warning(m.skills_upload_no_skill_found());
			return false;
		}
		return manualFormRef?.validate() ?? false;
	}

	export function getSkillData(): SkillUploadData {
		return {
			skillRootDir,
			formData: { ...formData },
			changedFiles,
		};
	}

	export async function writeChangedFiles(): Promise<void> {
		for (const [path, content] of changedFiles) {
			await writeFile(path, content);
		}
	}

	export function reset() {
		uploadState = "idle";
		extractedPath = "";
		skillRootDir = "";
		skillMdFilePath = "";
		errorMessage = "";
		changedFiles = new Map();
		formData = { name: "", description: "", content: "" };
		prevFormContent = "";
	}
</script>

{#if uploadState === "idle" || uploadState === "error"}
	<!-- 上传区域 -->
	<div class="px-6 py-6">
		<button
			type="button"
			class="flex w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 p-12 transition-colors hover:border-primary hover:bg-primary/5"
			onclick={handleClick}
		>
			<div
				class="bg-primary/10 text-primary flex h-16 w-16 items-center justify-center rounded-2xl"
			>
				<Upload class="h-8 w-8" />
			</div>
			<div class="text-center">
				<p class="text-foreground text-sm font-medium">{m.skills_upload_dropzone()}</p>
			</div>
		</button>

		{#if uploadState === "error" && errorMessage}
			<div class="mt-4 rounded-lg bg-red-50 p-3 text-center dark:bg-red-950/30">
				<p class="text-destructive text-sm">{errorMessage}</p>
			</div>
		{/if}
	</div>

	<input
		bind:this={fileInputRef}
		type="file"
		accept=".zip"
		class="hidden"
		onchange={handleFileInputChange}
	/>
{:else if uploadState === "extracting"}
	<!-- Loading state -->
	<div class="flex flex-col items-center justify-center px-6 py-12">
		<div
			class="bg-primary/10 text-primary mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
		>
			<Loader2 class="h-8 w-8 animate-spin" />
		</div>
		<p class="text-muted-foreground text-sm">{m.skills_upload_extracting()}</p>
	</div>
{:else}
	<!-- Ready state: show form -->
	<SkillManualForm
		bind:formData
		bind:this={manualFormRef}
		rootPath={skillRootDir}
		readOnly={false}
		{changedFiles}
		onFileChange={handleFileChange}
		onRootPathChange={handleRootPathChange}
		onFileRename={handleFileRename}
	/>
{/if}
