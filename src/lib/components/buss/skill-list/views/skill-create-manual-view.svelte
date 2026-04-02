<script lang="ts">
	import { createSkill, deleteSkill, updateSkill } from "$lib/api/skills";
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { toast } from "svelte-sonner";
	import SkillManualForm from "../skill-manual-form.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	interface Props {
		onRefresh?: () => void;
	}

	let { onRefresh }: Props = $props();

	const defaultContent = `---
name:
description:
---

# Skill 标题

描述这个 skill 的功能和使用场景...

## 使用方法
...
`;

	let formData = $state({
		name: "",
		description: "",
		content: defaultContent,
	});

	let manualFormRef = $state<SkillManualForm | undefined>();
	let isCreating = $state(false);

	async function handleCreate() {
		if (!manualFormRef?.validate()) return;

		isCreating = true;
		try {
			// 检查是否使用了文件树视图（有临时目录）
			const manualRootPath = manualFormRef?.getManualRootPath?.();

			if (manualRootPath) {
				// 使用文件树视图，需要写入修改的文件并打包整个目录
				await manualFormRef?.writeChangedFiles?.();

				// 先删除同名 skill 以避免重复
				await deleteSkill({ skill_list: [formData.name] });

				const result = await updateSkill({
					name: formData.name,
					dirPath: manualRootPath,
				});

				if (result.success) {
					toast.success(m.skills_create_success());
					onRefresh?.();
					skillsPanelState.reset();
				} else {
					toast.error(m.skills_create_failed());
				}
			} else {
				// 默认视图，只创建 SKILL.md
				// 先删除同名 skill 以避免重复
				await deleteSkill({ skill_list: [formData.name] });

				const result = await createSkill({
					name: formData.name,
					description: formData.description,
					content: formData.content,
				});

				if (result.success) {
					toast.success(m.skills_create_success());
					onRefresh?.();
					skillsPanelState.reset();
				} else {
					toast.error(m.skills_create_failed());
				}
			}
		} catch (error) {
			logger.error("Failed to create skill:", error);
			toast.error(m.skills_create_failed());
		} finally {
			isCreating = false;
		}
	}

	function handleCancel() {
		manualFormRef?.cleanup?.();
		skillsPanelState.pop();
	}
</script>

<div class="flex flex-col h-full">
	<div class="flex-1 min-h-0">
		<SkillManualForm bind:formData bind:this={manualFormRef} enableManualFileTree={true} />
	</div>

	<div class="shrink-0 flex gap-3 border-t px-6 py-4">
		<Button variant="outline" class="flex-1" onclick={handleCancel} disabled={isCreating}>
			{m.text_button_cancel()}
		</Button>
		<Button
			class="flex-1 bg-violet-500 hover:bg-violet-600"
			onclick={handleCreate}
			disabled={isCreating}
		>
			{isCreating ? m.skills_creating() : m.text_button_confirm()}
		</Button>
	</div>
</div>
