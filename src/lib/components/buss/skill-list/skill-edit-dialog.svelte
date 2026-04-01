<script lang="ts">
	import { deleteSkill, editSkillDetails, updateSkill } from "$lib/api/skills";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import { isOpenClawBundledSkill } from "$lib/utils/skill";
	import { Loader2, X } from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import { toast } from "svelte-sonner";
	import { SvelteMap } from "svelte/reactivity";
	import { getFrontMatterText, parseSkillFrontMatter } from "./skill-frontmatter";
	import SkillManualForm from "./skill-manual-form.svelte";

	interface Props {
		open: boolean;
		skill: Skill | null;
		onOpenChange?: (open: boolean) => void;
		onSave?: (
			skill: Skill,
			data: { name: string; description: string; content: string },
		) => void;
	}

	let { open = $bindable(false), skill, onOpenChange, onSave }: Props = $props();

	let isLoading = $state(false);
	let isSaving = $state(false);
	let manualFormRef = $state<SkillManualForm | undefined>();
	let extractedPath = $state("");

	let formData = $state({
		name: "",
		description: "",
		content: "",
	});

	const { readFile, scanDirectory, writeFile } = window.electronAPI.appService;

	// 记录修改过的文件
	let changedFiles = $state<Map<string, string>>(new Map());

	// 递归查找 SKILL.md 文件
	function findSkillMd(node: {
		name: string;
		path: string;
		children?: unknown[];
	}): string | null {
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
		// 移除最后的 /SKILL.md 或 \SKILL.md
		return skillMdPath.replace(/[/\\]SKILL\.md$/i, "");
	}

	$effect(() => {
		if (open && skill) {
			loadSkillContent(skill);
		}
	});

	let skillRootDir = $state("");
	let skillMdFilePath = $state(""); // 记录 SKILL.md 的完整路径

	async function loadSkillContent(skill: Skill) {
		isLoading = true;
		try {
			extractedPath = await editSkillDetails({
				skillName: skill.name,
				builtin: skill.isBuiltin,
			});

			// 扫描目录找到 SKILL.md
			const tree = await scanDirectory(extractedPath);
			const skillMdPath = findSkillMd(tree);

			if (!skillMdPath) {
				throw new Error("SKILL.md not found in extracted files");
			}

			skillRootDir = getSkillRootDir(skillMdPath);
			skillMdFilePath = skillMdPath; // 保存 SKILL.md 路径用于联动
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
			handleClose();
		} finally {
			isLoading = false;
		}
	}

	// 处理文件内容变化
	function handleFileChange(path: string, content: string) {
		// 使用新 Map 触发响应式更新
		const newMap = new SvelteMap(changedFiles);
		newMap.set(path, content);
		changedFiles = newMap;

		// 如果编辑的是 SKILL.md，联动更新 formData.content
		// 这样 skill-manual-form 中的 $effect 会自动解析 front matter 并更新 name/description
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

	// 处理根目录重命名（从文件树触发）
	const handleRootPathChange = (newRootPath: string) => {
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
	};

	function resetState() {
		formData = { name: "", description: "", content: "" };
		isLoading = false;
		isSaving = false;
		extractedPath = "";
		skillRootDir = "";
		skillMdFilePath = "";
		changedFiles = new Map();
		prevFormContent = "";
	}

	function handleClose() {
		open = false;
		onOpenChange?.(false);
		setTimeout(resetState, 150);
	}

	function handleOpenChange(v: boolean) {
		if (!v) {
			setTimeout(resetState, 150);
		}
		onOpenChange?.(v);
	}

	async function handleSave() {
		if (!manualFormRef?.validate()) return;
		if (!skill) return;

		isSaving = true;
		try {
			// 写入所有修改的文件到临时目录
			for (const [path, content] of changedFiles) {
				await writeFile(path, content);
			}

			// 先删除原始 skill 以避免重复
			await deleteSkill({ skill_list: [skill.name] });

			// 调用 API 上传更新的 skill
			// skillRootDir 是包含 SKILL.md 的目录，zip 名称使用 formData.name
			const result = await updateSkill({
				name: formData.name,
				dirPath: skillRootDir,
			});

			if (result.success) {
				toast.success(m.toast_save_success());
				onSave?.(skill, { ...formData });
				handleClose();
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

	// 文件树的根路径
	const treeRootPath = $derived(skillRootDir || "");

	// 内置 skill 不能保存
	const isBuiltin = $derived(skill?.isBuiltin ?? false);
	const isOpenClawBundled = $derived(isOpenClawBundledSkill(skill));
	const isReadOnly = $derived(isBuiltin || isOpenClawBundled);

	// 监听 formData.content 变化，同步更新 changedFiles（默认视图 → 文件树联动）
	let prevFormContent = $state("");
	$effect(() => {
		if (skillMdFilePath && formData.content !== prevFormContent) {
			// 使用新 Map 触发响应式更新
			const newMap = new SvelteMap(changedFiles);
			newMap.set(skillMdFilePath, formData.content);
			changedFiles = newMap;
			prevFormContent = formData.content;
		}
	});
</script>

<Dialog.Root bind:open onOpenChange={handleOpenChange}>
	<Dialog.Content class="min-w-[700px] rounded-2xl p-0" showCloseButton={false}>
		<!-- Header -->
		<div class="grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-3">
			<div></div>
			<span class="text-foreground text-base font-semibold">
				{m.text_button_edit()} - {skill?.name || ""}
			</span>
			<div class="flex justify-end">
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={handleClose}>
					<X class="h-4 w-4" />
				</Button>
			</div>
		</div>

		<!-- Content -->
		{#if isLoading}
			<div class="flex h-[400px] items-center justify-center">
				<Loader2 class="text-primary h-8 w-8 animate-spin" />
			</div>
		{:else}
			<SkillManualForm
				bind:formData
				bind:this={manualFormRef}
				rootPath={treeRootPath}
				readOnly={isReadOnly}
				{changedFiles}
				onFileChange={handleFileChange}
				onRootPathChange={handleRootPathChange}
				onFileRename={handleFileRename}
			/>
		{/if}

		<!-- Footer -->
		<div class="flex gap-3 border-t px-6 py-4">
			<Button variant="outline" class="flex-1" onclick={handleClose} disabled={isSaving}>
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
	</Dialog.Content>
</Dialog.Root>
