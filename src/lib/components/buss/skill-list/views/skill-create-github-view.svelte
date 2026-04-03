<script lang="ts">
	import { createSkillFromGitHub } from "$lib/api/skills";
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { toast } from "svelte-sonner";
	import SkillGithubForm from "../skill-github-form.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	interface Props {
		onRefresh?: () => void;
		initialUrl?: string;
	}

	let { onRefresh, initialUrl = "" }: Props = $props();

	let githubFormRef = $state<SkillGithubForm | undefined>();
	let isCreating = $state(false);

	async function handleCreate() {
		if (!githubFormRef?.validate()) return;

		const githubUrl = githubFormRef.getGitHubUrl();

		isCreating = true;
		try {
			const result = await createSkillFromGitHub(githubUrl);

			if (result.success) {
				toast.success(m.skills_create_success());
				skillsPanelState.clearPendingGitHubUrl();
				onRefresh?.();
				skillsPanelState.reset();
			} else {
				toast.error(m.skills_create_failed());
			}
		} catch (error) {
			logger.error("Failed to create skill from GitHub:", error);
			toast.error(m.skills_create_failed());
		} finally {
			isCreating = false;
		}
	}

	function handleCancel() {
		githubFormRef?.reset();
		skillsPanelState.clearPendingGitHubUrl();
		skillsPanelState.pop();
	}
</script>

<div class="flex flex-col h-full">
	<div class="flex-1 overflow-y-auto min-h-0">
		<SkillGithubForm bind:this={githubFormRef} {initialUrl} />
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
