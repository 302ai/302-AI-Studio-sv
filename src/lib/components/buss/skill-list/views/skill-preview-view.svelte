<script lang="ts">
	import { editSkillDetails } from "$lib/api/skills";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { isOpenClawBundledSkill } from "$lib/utils/skill";
	import type { Skill } from "@shared/types";
	import { toast } from "svelte-sonner";
	import SkillFileExplorer from "../skill-file-tree/skill-file-explorer.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	interface Props {
		skillName: string;
		skill?: Skill;
	}

	let { skillName, skill }: Props = $props();

	let isLoading = $state(true);
	let skillRootDir = $state("");

	const isBuiltin = $derived(skill?.isBuiltin ?? false);
	const isOpenClawBundled = $derived(isOpenClawBundledSkill(skill));

	const { scanDirectory } = window.electronAPI.appService;

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
			const extractedPath = await editSkillDetails({
				skillName: skill.name,
				builtin: skill.isBuiltin,
			});

			const tree = await scanDirectory(extractedPath);
			const skillMdPath = findSkillMd(tree);

			if (!skillMdPath) {
				throw new Error("SKILL.md not found in extracted files");
			}

			skillRootDir = getSkillRootDir(skillMdPath);
		} catch (error) {
			logger.error("Failed to load skill content:", error);
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

	function handleEdit() {
		// 从预览跳转到编辑时，替换当前视图而不是压栈
		skillsPanelState.replace({ type: "edit", skillName });
	}
</script>

<div class="flex h-full flex-col">
	{#if isLoading}
		<div class="flex h-[400px] items-center justify-center">
			<LdrsLoader type="dot-pulse" size={40} />
		</div>
	{:else}
		<!-- 文件树预览 -->
		<div class="flex-1 min-h-0 px-6 py-4">
			{#if skillRootDir}
				<SkillFileExplorer
					rootPath={skillRootDir}
					readOnly={true}
					lineWrapping={false}
					defaultExpandAll={true}
				/>
			{/if}
		</div>

		{#if !isBuiltin && !isOpenClawBundled}
			<!-- Footer - only show edit button for non-builtin skills -->
			<div class="flex gap-3 border-t px-6 py-4">
				<Button class="flex-1 bg-violet-500 hover:bg-violet-600" onclick={handleEdit}>
					{m.text_button_edit()}
				</Button>
			</div>
		{/if}
	{/if}
</div>
