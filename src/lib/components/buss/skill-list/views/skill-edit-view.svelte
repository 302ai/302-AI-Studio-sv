<script lang="ts">
	import { deleteSkill, editSkillDetails, updateSkill } from "$lib/api/skills";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { isOpenClawBundledSkill } from "$lib/utils/skill";
	import { Loader2 } from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import { toast } from "svelte-sonner";
	import { SvelteMap } from "svelte/reactivity";
	import { getFrontMatterText, parseSkillFrontMatter } from "../skill-frontmatter";
	import SkillManualForm from "../skill-manual-form.svelte";

	interface Props {
		skillName: string;
		skill?: Skill;
		onRefresh?: () => void;
	}

	let { skillName, skill, onRefresh }: Props = $props();

	let isLoading = $state(true);
	let isSaving = $state(false);
	let manualFormRef = $state<SkillManualForm | undefined>();
	let extractedPath = $state("");
	let skillRootDir = $state("");
	let skillMdFilePath = $state("");
	let changedFiles = $state<Map<string, string>>(new Map());
	let prevFormContent = $state("");

	let formData = $state({
		name: "",
		description: "",
		content: "",
	});

	const isBuiltin = $derived(skill?.isBuiltin ?? false);
	const isOpenClawBundled = $derived(isOpenClawBundledSkill(skill));
	const isReadOnly = $derived(isBuiltin || isOpenClawBundled);

	const { readFile, scanDirectory, writeFile } = window.electronAPI.appService;

	// 递归查找 SKILL.md 文件
	function findSkillMd(node: { name: string; path: string; children?: unknown[] }): string | null {
		if (node.name === "SKILL.md") {
			return node.path;
		}
		if (node.children) {
			for (const child of node.children as (typeof node)[]) {
				const found = findSkillMd(child);
				if (found) return found;
			}
		}
		return null;
	}

	// 获取 SKILL.md 所在的目录作为文件树根路径
	function getSkillRootDir(skillMdPath: string): string {
		return skillMdPath.replace(/[/\\]SKILL\.md$/i, "");
	}

	async function loadSkillContent() {
		if (!skill) return;

		isLoading = true;
		try {
			extractedPath = await editSkillDetails({
				skillName: skill.name,
				builtin: skill.isBuiltin,
			});

			const tree = await scanDirectory(extractedPath);
			const skillMdPath = findSkillMd(tree);

			if (!skillMdPath) {
				throw new Error("SKILL.md not found in extracted files");
			}

			skillRootDir = getSkillRootDir(skillMdPath);
			skillMdFilePath = skillMdPath;
			const content = await readFile(skillMdPath);
			const parsed = parseSkillFrontMatter(content);

			formData = {
				name: getFrontMatterText(parsed.data, "name") || skill.name,
				description: getFrontMatterText(parsed.data, "description") || skill.description,
				content: content,
			};
		} catch (error) {
			console.error("Failed to load skill content:", error);
			const errorMessage = error instanceof Error ? error.message : m.skills_load_failed();
			toast.error(errorMessage);
			skillsPanelState.pop();
		} finally {
			isLoading = false;
		}
	}

	// 加载 skill 内容
	$effect(() => {
		if (skillName) {
			loadSkillContent();
		}
	});

	// 处理文件内容变化
	function handleFileChange(path: string, content: string) {
		const newMap = new SvelteMap(changedFiles);
		newMap.set(path, content);
		changedFiles = newMap;

		if (path === skillMdFilePath) {
			formData.content = content;
		}
	}

	// 处理文件/文件夹重命名
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

	// 处理根目录重命名
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

	// 监听 formData.content 变化，同步更新 changedFiles
	$effect(() => {
		if (skillMdFilePath && formData.content !== prevFormContent) {
			const newMap = new SvelteMap(changedFiles);
			newMap.set(skillMdFilePath, formData.content);
			changedFiles = newMap;
			prevFormContent = formData.content;
		}
	});

	async function handleSave() {
		if (!manualFormRef?.validate()) return;

		isSaving = true;
		try {
			// 写入所有修改的文件到临时目录
			for (const [path, content] of changedFiles) {
				await writeFile(path, content);
			}

			// 先删除原始 skill 以避免重复
			await deleteSkill({ skill_list: [skillName] });

			const result = await updateSkill({
				name: formData.name,
				dirPath: skillRootDir,
			});

			if (result.success) {
				toast.success(m.toast_save_success());
				onRefresh?.();
				skillsPanelState.reset();
			} else {
				toast.error(m.skills_load_failed());
			}
		} catch (error) {
			console.error("Failed to save skill:", error);
			toast.error(m.skills_load_failed());
		} finally {
			isSaving = false;
		}
	}

	function handleCancel() {
		skillsPanelState.pop();
	}
</script>

<div class="flex flex-col h-full">
	{#if isLoading}
		<div class="flex h-[400px] items-center justify-center">
			<LdrsLoader type="dot-pulse" size={40} />
		</div>
	{:else}
		<div class="flex-1 min-h-0">
			<SkillManualForm
				bind:formData
				bind:this={manualFormRef}
				rootPath={skillRootDir}
				readOnly={isReadOnly}
				{changedFiles}
				onFileChange={handleFileChange}
				onRootPathChange={handleRootPathChange}
				onFileRename={handleFileRename}
			/>
		</div>

		<div class="shrink-0 flex gap-3 border-t px-6 py-4">
			<Button variant="outline" class="flex-1" onclick={handleCancel} disabled={isSaving}>
				{m.text_button_cancel()}
			</Button>
			<Button
				class="flex-1 bg-violet-500 hover:bg-violet-600"
				onclick={handleSave}
				disabled={isLoading || isSaving || isReadOnly}
			>
				{#if isSaving}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				{m.text_button_save()}
			</Button>
		</div>
	{/if}
</div>
