<script lang="ts">
	import { deleteSkill, updateSkill } from "$lib/api/skills";
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { toast } from "svelte-sonner";
	import SkillUploadForm from "../skill-upload-form.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	interface Props {
		onRefresh?: () => void;
	}

	let { onRefresh }: Props = $props();

	let uploadFormRef = $state<SkillUploadForm | undefined>();
	let isCreating = $state(false);

	async function handleCreate() {
		if (!uploadFormRef?.validate()) return;

		const { skillRootDir, formData } = uploadFormRef.getSkillData();

		isCreating = true;
		try {
			// Write changed files to temp directory
			await uploadFormRef.writeChangedFiles();

			// 先删除同名 skill 以避免重复
			await deleteSkill({ skill_list: [formData.name] });

			// Zip and upload
			const result = await updateSkill({
				name: formData.name,
				dirPath: skillRootDir,
			});

			if (result.success) {
				toast.success(m.skills_create_success());
				onRefresh?.();
				skillsPanelState.reset();
			} else {
				toast.error(m.skills_create_failed());
			}
		} catch (error) {
			logger.error("Failed to create skill from upload:", error);
			toast.error(m.skills_create_failed());
		} finally {
			isCreating = false;
		}
	}

	function handleCancel() {
		uploadFormRef?.reset();
		skillsPanelState.pop();
	}
</script>

<div class="flex flex-col h-full">
	<div class="flex-1 overflow-y-auto min-h-0">
		<SkillUploadForm bind:this={uploadFormRef} />
	</div>

	<div class="flex gap-3 border-t px-6 py-4">
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
