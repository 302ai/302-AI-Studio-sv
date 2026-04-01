<script lang="ts">
	import CodeMirrorEditor from "$lib/components/buss/editor/codemirror-editor.svelte";
	import SkillFileExplorer from "$lib/components/buss/skill-list/skill-file-tree/skill-file-explorer.svelte";
	import Button from "$lib/components/ui/button/button.svelte";
	import Input from "$lib/components/ui/input/input.svelte";
	import { Label } from "$lib/components/ui/label";
	import { m } from "$lib/paraglide/messages";
	import { Loader2 } from "@lucide/svelte";
	import { mode } from "mode-watcher";
	import { toast } from "svelte-sonner";
	import { SvelteMap } from "svelte/reactivity";
	import {
		getFrontMatterText,
		parseSkillFrontMatter,
		stringifySkillFrontMatter,
		updateSkillFrontMatterTextFields,
	} from "./skill-frontmatter";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	export interface SkillFormData {
		name: string;
		description: string;
		content: string;
	}

	interface Props {
		formData: SkillFormData;
		rootPath?: string;
		readOnly?: boolean;
		changedFiles?: Map<string, string>;
		onFileChange?: (path: string, content: string) => void;
		enableManualFileTree?: boolean;
		onRootPathChange?: (newRootPath: string) => void;
		onFileRename?: (oldPath: string, newPath: string) => void;
	}

	let {
		formData = $bindable(),
		rootPath,
		readOnly = true,
		changedFiles,
		onFileChange,
		enableManualFileTree = false,
		onRootPathChange,
		onFileRename,
	}: Props = $props();

	let viewMode = $state<"default" | "tree">("default");
	let manualRootPath = $state<string | undefined>(undefined);
	let manualSkillMdPath = $state<string | undefined>(undefined);
	let manualChangedFiles: SvelteMap<string, string> = new SvelteMap();
	let isCreatingTempDir = $state(false);

	const effectiveRootPath = $derived(rootPath || manualRootPath);
	const effectiveChangedFiles = $derived(rootPath ? changedFiles : manualChangedFiles);

	async function handleViewModeChange(mode: "default" | "tree") {
		if (mode === "tree" && !effectiveRootPath && enableManualFileTree) {
			isCreatingTempDir = true;
			try {
				const skillName = formData.name.trim() || "new-skill";
				const result = await window.electronAPI.appService.createSkillTempDir(skillName);
				manualRootPath = result.rootPath;
				manualSkillMdPath = result.skillMdPath;
				manualChangedFiles = new SvelteMap([[result.skillMdPath, formData.content]]);
			} catch (error) {
				logger.error("Failed to create temp directory:", error);
				toast.error(m.skills_create_temp_dir_failed());
				return;
			} finally {
				isCreatingTempDir = false;
			}
		}

		viewMode = mode;
	}

	function handleManualFileChange(path: string, content: string) {
		manualChangedFiles.set(path, content);

		if (path === manualSkillMdPath) {
			formData.content = content;
		}

		onFileChange?.(path, content);
	}

	function handleManualFileRename(oldPath: string, newPath: string) {
		const newChangedFiles = new SvelteMap<string, string>();
		for (const [path, content] of manualChangedFiles) {
			if (path === oldPath) {
				newChangedFiles.set(newPath, content);
			} else if (path.startsWith(oldPath + "/") || path.startsWith(oldPath + "\\")) {
				const newFilePath = path.replace(oldPath, newPath);
				newChangedFiles.set(newFilePath, content);
			} else {
				newChangedFiles.set(path, content);
			}
		}
		manualChangedFiles = newChangedFiles;

		if (oldPath === manualSkillMdPath) {
			manualSkillMdPath = newPath;
		} else if (
			manualSkillMdPath &&
			(manualSkillMdPath.startsWith(oldPath + "/") || manualSkillMdPath.startsWith(oldPath + "\\"))
		) {
			manualSkillMdPath = manualSkillMdPath.replace(oldPath, newPath);
		}

		onFileRename?.(oldPath, newPath);
	}

	function handleRootPathChange(newRootPath: string) {
		if (!rootPath && manualRootPath) {
			const oldRootPath = manualRootPath;
			const newChangedFiles = new SvelteMap<string, string>();

			for (const [path, content] of manualChangedFiles) {
				if (path.startsWith(oldRootPath)) {
					const nextPath = path.replace(oldRootPath, newRootPath);
					newChangedFiles.set(nextPath, content);
				} else {
					newChangedFiles.set(path, content);
				}
			}

			manualChangedFiles = newChangedFiles;

			if (manualSkillMdPath && manualSkillMdPath.startsWith(oldRootPath)) {
				manualSkillMdPath = manualSkillMdPath.replace(oldRootPath, newRootPath);
			}

			manualRootPath = newRootPath;
		} else if (rootPath && onRootPathChange) {
			onRootPathChange(newRootPath);
		}
	}

	$effect(() => {
		if (
			manualSkillMdPath &&
			!rootPath &&
			formData.content !== manualChangedFiles.get(manualSkillMdPath)
		) {
			manualChangedFiles.set(manualSkillMdPath, formData.content);
		}
	});

	let isRenaming = $state(false);
	$effect(() => {
		const newName = formData.name.trim() || "new-skill";
		if (manualRootPath && !isRenaming) {
			const currentDirName = manualRootPath.split(/[/\\]/).pop() || "";
			if (newName !== currentDirName) {
				const oldRootPath = manualRootPath;
				const parentPath = oldRootPath.substring(0, oldRootPath.length - currentDirName.length - 1);
				const newRootPath = `${parentPath}/${newName}`;

				isRenaming = true;
				setTimeout(async () => {
					try {
						await window.electronAPI.appService.renameFile(oldRootPath, newRootPath);
						handleRootPathChange(newRootPath);
					} catch (error) {
						logger.error("Failed to rename directory:", error);
					} finally {
						isRenaming = false;
					}
				}, 0);
			}
		}
	});

	export async function cleanup(): Promise<void> {
		if (manualRootPath) {
			try {
				await window.electronAPI.appService.deleteTempDir(manualRootPath);
			} catch (error) {
				logger.error("Failed to cleanup temp directory:", error);
			}

			manualRootPath = undefined;
			manualSkillMdPath = undefined;
			manualChangedFiles = new SvelteMap();
		}
	}

	export function getManualRootPath(): string | undefined {
		return manualRootPath;
	}

	export async function writeChangedFiles(): Promise<void> {
		for (const [path, content] of manualChangedFiles) {
			await window.electronAPI.appService.writeFile(path, content);
		}
	}

	export function reset(): void {
		viewMode = "default";
		manualRootPath = undefined;
		manualSkillMdPath = undefined;
		manualChangedFiles = new SvelteMap();
	}

	let prevName = $state(formData.name);
	let prevDesc = $state(formData.description);
	let prevContent = $state(formData.content);

	$effect(() => {
		const nameChanged = formData.name !== prevName;
		const descChanged = formData.description !== prevDesc;

		if (nameChanged || descChanged) {
			if (!formData.content.trim()) {
				if (formData.name || formData.description) {
					const newContent = stringifySkillFrontMatter(
						{
							name: formData.name,
							description: formData.description,
							license: "Complete terms in LICENSE.txt",
						},
						"",
					);
					formData.content = newContent;
					prevContent = newContent;
				}
			} else {
				const parsed = parseSkillFrontMatter(formData.content);
				const parsedName = getFrontMatterText(parsed.data, "name");
				const parsedDescription = getFrontMatterText(parsed.data, "description");

				if (parsedName !== formData.name || parsedDescription !== formData.description) {
					const newContent = updateSkillFrontMatterTextFields(formData.content, {
						name: formData.name,
						description: formData.description,
					});
					formData.content = newContent;
					prevContent = newContent;
				}
			}
		}

		prevName = formData.name;
		prevDesc = formData.description;
	});

	$effect(() => {
		if (formData.content !== prevContent) {
			if (!formData.content.trim()) {
				formData.name = "";
				formData.description = "";
				prevName = "";
				prevDesc = "";
			} else {
				const parsed = parseSkillFrontMatter(formData.content);
				const parsedName = getFrontMatterText(parsed.data, "name");
				const parsedDescription = getFrontMatterText(parsed.data, "description");

				if (parsedName !== undefined && parsedName !== formData.name) {
					formData.name = parsedName;
					prevName = parsedName;
				}

				if (parsedDescription !== undefined && parsedDescription !== formData.description) {
					formData.description = parsedDescription;
					prevDesc = parsedDescription;
				}
			}

			prevContent = formData.content;
		}
	});

	export function validate(): boolean {
		if (!formData.name.trim()) {
			toast.warning(m.skills_form_name_required());
			return false;
		}
		if (/\s/.test(formData.name)) {
			toast.warning(m.skills_form_name_no_spaces());
			return false;
		}
		if (!formData.description.trim()) {
			toast.warning(m.skills_form_desc_required());
			return false;
		}
		if (!formData.content.trim()) {
			toast.warning(m.skills_form_content_required());
			return false;
		}
		return true;
	}
</script>

<div class="flex h-full flex-col gap-4 px-6 py-6">
	<div class="shrink-0 space-y-2">
		<Label for="skill-name" class="text-sm font-medium">
			{m.skills_form_name()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-name"
			bind:value={formData.name}
			placeholder={m.skills_form_name_placeholder()}
			class="dark:border-[#3d3d3d]"
		/>
	</div>

	<div class="shrink-0 space-y-2">
		<Label for="skill-desc" class="text-sm font-medium">
			{m.skills_form_desc()} <span class="text-destructive">*</span>
		</Label>
		<Input
			id="skill-desc"
			bind:value={formData.description}
			placeholder={m.skills_form_desc_placeholder()}
			class="dark:border-[#3d3d3d]"
		/>
	</div>

	<div class="flex min-h-0 flex-1 flex-col space-y-2">
		<!-- Label with toggle buttons -->
		<div class="flex shrink-0 items-center justify-between">
			<Label for="skill-content" class="text-sm font-medium">
				{m.skills_form_content()} <span class="text-destructive">*</span>
			</Label>
			{#if rootPath || enableManualFileTree}
				<div class="flex rounded-md border">
					<Button
						variant="ghost"
						size="sm"
						class="h-7 rounded-r-none px-3 text-xs {viewMode === 'default'
							? 'bg-violet-500 text-white hover:bg-violet-600 hover:text-white'
							: ''}"
						onclick={() => handleViewModeChange("default")}
						disabled={isCreatingTempDir}
					>
						{m.skills_form_view_default()}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="h-7 rounded-l-none px-3 text-xs {viewMode === 'tree'
							? 'bg-violet-500 text-white hover:bg-violet-600 hover:text-white'
							: ''}"
						onclick={() => handleViewModeChange("tree")}
						disabled={isCreatingTempDir}
					>
						{#if isCreatingTempDir}
							<Loader2 class="mr-1 h-3 w-3 animate-spin" />
						{/if}
						{m.skills_form_view_tree()}
					</Button>
				</div>
			{/if}
		</div>

		<!-- Content area -->
		{#if viewMode === "default"}
			<div class="min-h-0 flex-1 overflow-hidden rounded-md border">
				<CodeMirrorEditor
					value={formData.content}
					language="md"
					theme={mode.current === "dark" ? "dark" : "light"}
					readOnly={false}
					onChange={(value) => (formData.content = value)}
				/>
			</div>
			<p class="shrink-0 text-muted-foreground text-xs">{m.skills_form_content_hint()}</p>
		{:else if effectiveRootPath}
			<div class="min-h-0 flex-1 overflow-hidden rounded-md">
				<SkillFileExplorer
					rootPath={effectiveRootPath}
					readOnly={rootPath ? readOnly : false}
					defaultExpandAll={true}
					changedFiles={effectiveChangedFiles}
					onFileChange={rootPath ? onFileChange : handleManualFileChange}
					onRootPathChange={rootPath && onRootPathChange ? onRootPathChange : handleRootPathChange}
					onFileRename={rootPath ? onFileRename : handleManualFileRename}
				/>
			</div>
		{/if}
	</div>
</div>
