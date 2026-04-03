<script lang="ts">
	import { listSkills } from "$lib/api/skills";
	import type { ListSkillsResponse } from "$lib/api/skills/base-apis";
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import type { Skill } from "@shared/types";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import SkillsPanelHeader from "./skills-panel-header.svelte";
	import SkillCreateGithubView from "./views/skill-create-github-view.svelte";
	import SkillCreateHistoryView from "./views/skill-create-history-view.svelte";
	import SkillCreateManualView from "./views/skill-create-manual-view.svelte";
	import SkillCreateSelectView from "./views/skill-create-select-view.svelte";
	import SkillCreateUploadView from "./views/skill-create-upload-view.svelte";
	import SkillDetailView from "./views/skill-detail-view.svelte";
	import SkillEditView from "./views/skill-edit-view.svelte";
	import SkillPreviewView from "./views/skill-preview-view.svelte";
	import SkillsListView from "./views/skills-list-view.svelte";
	import { createLogger } from "@shared/logger";

	const logger = createLogger("ui");

	let skillsData = $state<ListSkillsResponse>({
		success: true,
		builtin_skills: [],
		user_skills: [],
		project_skills: [],
	});
	let loading = $state(true);

	async function loadSkills() {
		loading = true;
		try {
			const data = await listSkills({});
			skillsData = data;
		} catch (e) {
			logger.error("Failed to load skills:", e);
			toast.error(m.skills_load_failed());
		} finally {
			loading = false;
		}
	}

	function findSkill(name: string): Skill | undefined {
		return (
			skillsData.user_skills.find((s) => s.name === name) ||
			skillsData.builtin_skills.find((s) => s.name === name)
		);
	}

	function updateSkillFavoriteState(
		skillName: string,
		is_favorite: boolean,
		favorite_at: string | null,
	) {
		const updateSkills = (skills: Skill[]) =>
			skills.map((skill) =>
				skill.name === skillName ? { ...skill, is_favorite, favorite_at } : skill,
			);

		skillsData = {
			...skillsData,
			user_skills: updateSkills(skillsData.user_skills),
			builtin_skills: updateSkills(skillsData.builtin_skills),
			project_skills: updateSkills(skillsData.project_skills),
		};
	}

	onMount(() => {
		// Reset to list view when mounting
		skillsPanelState.reset();
		loadSkills();

		// Listen for skill import requests from deep links
		const unsubscribe = window.electronAPI.skill.onSkillImportRequested((data) => {
			logger.info("Received skill import request:", data.url);
			skillsPanelState.goToCreateGitHubWithUrl(data.url);
			toast.info(m.skills_import_from_link());
		});

		return () => {
			unsubscribe?.();
		};
	});
</script>

<div class="flex h-full flex-col">
	<!-- Skills Panel Header (only show when not on list view) -->
	{#if skillsPanelState.currentView.type !== "list"}
		<SkillsPanelHeader
			currentView={skillsPanelState.currentView}
			viewStack={skillsPanelState.viewStack}
			canGoBack={skillsPanelState.canGoBack}
			isPinned={false}
			showPinButton={false}
			showCloseButton={false}
			onBack={() => skillsPanelState.pop()}
			onClose={() => {}}
			onTogglePin={() => {}}
			skillName={skillsPanelState.currentView.type === "detail" ||
			skillsPanelState.currentView.type === "edit" ||
			skillsPanelState.currentView.type === "preview"
				? skillsPanelState.currentView.skillName
				: ""}
		/>
	{/if}

	<!-- Skills Content Area -->
	<div class="flex-1 overflow-y-auto min-h-0">
		{#if skillsPanelState.currentView.type === "list"}
			<SkillsListView
				userSkills={skillsData.user_skills}
				builtinSkills={skillsData.builtin_skills}
				{loading}
				showUseButton={false}
				showBorder={false}
				onRefresh={loadSkills}
				onFavoriteChange={updateSkillFavoriteState}
			/>
		{:else if skillsPanelState.currentView.type === "detail"}
			<SkillDetailView
				skillName={skillsPanelState.currentView.skillName}
				skill={findSkill(skillsPanelState.currentView.skillName)}
			/>
		{:else if skillsPanelState.currentView.type === "preview"}
			<SkillPreviewView
				skillName={skillsPanelState.currentView.skillName}
				skill={findSkill(skillsPanelState.currentView.skillName)}
			/>
		{:else if skillsPanelState.currentView.type === "edit"}
			<SkillEditView
				skillName={skillsPanelState.currentView.skillName}
				skill={findSkill(skillsPanelState.currentView.skillName)}
				onRefresh={loadSkills}
			/>
		{:else if skillsPanelState.currentView.type === "create-select"}
			<SkillCreateSelectView />
		{:else if skillsPanelState.currentView.type === "create-manual"}
			<SkillCreateManualView onRefresh={loadSkills} />
		{:else if skillsPanelState.currentView.type === "create-upload"}
			<SkillCreateUploadView onRefresh={loadSkills} />
		{:else if skillsPanelState.currentView.type === "create-github"}
			<SkillCreateGithubView
				onRefresh={loadSkills}
				initialUrl={skillsPanelState.currentView.initialUrl}
			/>
		{:else if skillsPanelState.currentView.type === "create-history"}
			<SkillCreateHistoryView />
		{/if}
	</div>
</div>
