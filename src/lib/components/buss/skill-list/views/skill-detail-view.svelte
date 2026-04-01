<script lang="ts">
	import { downloadSkill } from "$lib/api/skills";
	import Button from "$lib/components/ui/button/button.svelte";
	import { m } from "$lib/paraglide/messages";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { isOpenClawBundledSkill } from "$lib/utils/skill";
	import { Loader2, Zap } from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import { toast } from "svelte-sonner";

	interface Props {
		skillName: string;
		skill?: Skill;
	}

	let { skillName, skill }: Props = $props();

	let downloading = $state(false);

	// 内置的 skill 不能编辑
	const isBuiltin = $derived(skill?.isBuiltin ?? false);
	const isOpenClawBundled = $derived(isOpenClawBundledSkill(skill));

	const description = $derived(
		skill
			? generalSettings.language === "zh" && skill.description_zh
				? skill.description_zh
				: skill.description
			: "",
	);

	function handlePreview() {
		skillsPanelState.goToPreview(skillName);
	}

	function handleEdit() {
		skillsPanelState.goToEdit(skillName);
	}

	async function handleDownload() {
		if (!skill || downloading) return;

		downloading = true;
		const toastId = toast.loading(m.skills_downloading());

		try {
			const blob = await downloadSkill(skill.name, skill.isBuiltin);

			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${skill.name}.zip`;
			a.click();
			URL.revokeObjectURL(url);

			toast.dismiss(toastId);
			toast.success(m.skills_download_success());
		} catch (e) {
			console.error("Failed to download skill:", e);
			toast.dismiss(toastId);
			toast.error(m.skills_download_failed());
		} finally {
			downloading = false;
		}
	}
</script>

<div class="flex flex-col h-full">
	<!-- Content -->
	<div class="flex flex-col items-center px-6 py-8 flex-1">
		<!-- Large Icon -->
		<div
			class="bg-primary/10 text-primary mb-4 flex h-20 w-20 items-center justify-center rounded-2xl"
		>
			<Zap class="h-10 w-10" />
		</div>

		<!-- Skill Name -->
		<h2 class="mb-8 text-xl font-semibold">{skill?.name ?? ""}</h2>

		<!-- Description Section -->
		<div class="w-full">
			<h3 class="text-[#6b7280] dark:text-gray-400 mb-2 text-sm font-semibold">
				{m.skills_description()}
			</h3>
			<p class="text-[#6b7280] dark:text-gray-400 text-sm leading-relaxed">
				{description}
			</p>
		</div>
	</div>

	{#if !isOpenClawBundled}
		<!-- Footer -->
		<div class="flex gap-3 border-t px-6 py-4">
			<Button
				variant="secondary"
				class="flex-1"
				onclick={handleDownload}
				disabled={downloading}
			>
				{#if downloading}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				{m.skills_download()}
			</Button>
			<Button variant="outline" class="flex-1" onclick={handlePreview}>
				{m.label_tab_preview()}
			</Button>
			{#if !isBuiltin}
				<Button class="flex-1 bg-violet-500 hover:bg-violet-600" onclick={handleEdit}>
					{m.text_button_edit()}
				</Button>
			{/if}
		</div>
	{/if}
</div>
