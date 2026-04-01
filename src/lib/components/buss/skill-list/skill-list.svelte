<script lang="ts">
	import { addSkillFavorite, cancelSkillFavorite, downloadSkill } from "$lib/api/skills";
	import { deleteSkill } from "$lib/api/skills/base-apis";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import Input from "$lib/components/ui/input/input.svelte";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import { isOpenClawBundledSkill } from "$lib/utils/skill";
	import { Plus, Search, ShoppingBag } from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import { toast } from "svelte-sonner";
	import { SvelteMap, SvelteSet } from "svelte/reactivity";
	import { canFavoriteSkill } from "./skill-favorite-availability";
	import SkillCard from "./skill-card.svelte";
	import SkillCreateDialog from "./skill-create-dialog.svelte";
	import SkillDetailDialog from "./skill-detail-dialog.svelte";
	import SkillEditDialog from "./skill-edit-dialog.svelte";
	import { getOrderedSkillsByFavorite } from "./skill-favorite-order";

	interface Props {
		userSkills: Skill[];
		builtinSkills: Skill[];
		usedSkills?: Skill[];
		title?: string;
		showSearch?: boolean;
		loading?: boolean;
		showNewButton?: boolean;
		onUse?: (skill: Skill) => void;
		onRemove?: (skill: Skill) => void;
		onRefresh?: () => void | Promise<void>;
		onForceUseToggle?: (skill: Skill, forceUse: boolean) => void;
	}

	const {
		userSkills,
		builtinSkills,
		usedSkills = [],
		title,
		showSearch = true,
		loading = false,
		showNewButton = true,
		onUse,
		onRemove,
		onRefresh,
		onForceUseToggle,
	}: Props = $props();

	let searchQuery = $state("");
	let detailDialogOpen = $state(false);
	let createDialogOpen = $state(false);
	let editDialogOpen = $state(false);
	let deleteDialogOpen = $state(false);
	let selectedSkill = $state<Skill | null>(null);
	let editingSkill = $state<Skill | null>(null);
	let deletingSkill = $state<Skill | null>(null);
	let isDeleting = $state(false);
	let downloadingSkills = new SvelteSet<string>();
	let favoritingSkills = new SvelteSet<string>();
	let localUserSkills = $state<Skill[]>([]);
	let localBuiltinSkills = $state<Skill[]>([]);
	let optimisticFavoriteStates = new SvelteMap<string, boolean>();
	let optimisticFavoriteAts = new SvelteMap<string, string | null>();

	const currentAgentId = $derived(codeAgentState.currentAgentId);
	const currentCodeAgentType = $derived(codeAgentState.type);

	$effect(() => {
		localUserSkills = userSkills;
		localBuiltinSkills = builtinSkills;
	});

	$effect(() => {
		const persistedFavoriteStates = new Map(
			[...localBuiltinSkills, ...localUserSkills].map((skill) => [
				skill.name,
				skill.is_favorite ?? false,
			]),
		);
		const persistedFavoriteAts = new Map(
			[...localBuiltinSkills, ...localUserSkills].map((skill) => [
				skill.name,
				skill.favorite_at ?? null,
			]),
		);

		for (const [skillName, optimisticFavorite] of Array.from(
			optimisticFavoriteStates.entries(),
		)) {
			if (!persistedFavoriteStates.has(skillName)) {
				optimisticFavoriteStates.delete(skillName);
				optimisticFavoriteAts.delete(skillName);
				continue;
			}

			if (persistedFavoriteStates.get(skillName) === optimisticFavorite) {
				optimisticFavoriteStates.delete(skillName);
			}
		}

		for (const [skillName, optimisticFavoriteAt] of Array.from(
			optimisticFavoriteAts.entries(),
		)) {
			if (!persistedFavoriteAts.has(skillName)) {
				optimisticFavoriteAts.delete(skillName);
				optimisticFavoriteStates.delete(skillName);
				continue;
			}

			if (persistedFavoriteAts.get(skillName) === optimisticFavoriteAt) {
				optimisticFavoriteAts.delete(skillName);
			}
		}
	});

	// Combine skills with source flag
	const baseSkills = $derived<Skill[]>(
		[...localBuiltinSkills, ...localUserSkills].filter(
			(skill) => !(currentAgentId === "claude-code" && isOpenClawBundledSkill(skill)),
		),
	);

	const allSkills = $derived.by(() =>
		getOrderedSkillsByFavorite(baseSkills, optimisticFavoriteStates, optimisticFavoriteAts),
	);

	const filteredSkills = $derived(
		allSkills.filter(
			(item) =>
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.description.toLowerCase().includes(searchQuery.toLowerCase()),
		),
	);

	function handleSelectSkill(skill: Skill) {
		selectedSkill = skill;
		detailDialogOpen = true;
	}

	function handleNew() {
		createDialogOpen = true;
	}

	function handleEdit(skill: Skill) {
		if (isOpenClawBundledSkill(skill)) {
			return;
		}

		editingSkill = skill;
		editDialogOpen = true;
	}

	async function handleDownload(skill: Skill) {
		// 防止重复点击
		if (downloadingSkills.has(skill.name)) return;

		downloadingSkills.add(skill.name);

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
			downloadingSkills.delete(skill.name);
		}
	}

	function handleDelete(skill: Skill) {
		if (isOpenClawBundledSkill(skill)) {
			return;
		}

		deletingSkill = skill;
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!deletingSkill) return;

		isDeleting = true;
		const toastId = toast.loading(m.skills_deleting());

		try {
			await deleteSkill({ skill_list: [deletingSkill.name] });
			codeAgentState.handleSkillsRemove([deletingSkill]);

			toast.dismiss(toastId);
			toast.success(m.skills_delete_success());
			deleteDialogOpen = false;
			deletingSkill = null;
			onRefresh?.();
		} catch (e) {
			console.error("Failed to delete skill:", e);
			toast.dismiss(toastId);
			toast.error(m.skills_delete_failed());
		} finally {
			isDeleting = false;
		}
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

		localUserSkills = updateSkills(localUserSkills);
		localBuiltinSkills = updateSkills(localBuiltinSkills);
	}

	async function handleFavoriteToggle(skill: Skill) {
		if (!canFavoriteSkill(currentCodeAgentType, skill.isBuiltin ?? false)) {
			return;
		}

		if (favoritingSkills.has(skill.name)) return;

		const previousFavoriteState = skill.is_favorite ?? false;
		const previousFavoriteAt = skill.favorite_at ?? null;
		const nextFavoriteState = !previousFavoriteState;
		const nextFavoriteAt = nextFavoriteState ? new Date().toISOString() : null;

		optimisticFavoriteStates.set(skill.name, nextFavoriteState);
		optimisticFavoriteAts.set(skill.name, nextFavoriteAt);
		favoritingSkills.add(skill.name);

		try {
			if (nextFavoriteState) {
				await addSkillFavorite({ skill_list: [skill.name] });
			} else {
				await cancelSkillFavorite({ skill_list: [skill.name] });
			}

			updateSkillFavoriteState(skill.name, nextFavoriteState, nextFavoriteAt);
		} catch (e) {
			optimisticFavoriteStates.set(skill.name, previousFavoriteState);
			optimisticFavoriteAts.set(skill.name, previousFavoriteAt);
			console.error("Failed to toggle skill favorite:", e);
			toast.error(e instanceof Error ? e.message : m.error_unexpected_occurred());
		} finally {
			favoritingSkills.delete(skill.name);
		}
	}
</script>

<div class="flex flex-col gap-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		{#if title}
			<h1 class="text-lg font-medium text-[#333333] dark:text-[#E6E6E6]">{title}</h1>
		{/if}
	</div>

	<!-- Search and New Button -->
	{#if showSearch || showNewButton}
		<div class="flex flex-col gap-3">
			<div class="flex items-center gap-3">
				{#if showSearch}
					<div class="relative flex-1">
						<Search
							class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
						/>
						<Input
							type="text"
							placeholder={m.skills_search_placeholder()}
							class="border-border bg-transparent pl-9"
							bind:value={searchQuery}
						/>
					</div>
				{/if}
				{#if showNewButton}
					<Button class="gap-2 bg-violet-500 hover:bg-violet-600" onclick={handleNew}>
						<Plus class="h-4 w-4" />
						{m.skills_new()}
					</Button>
				{/if}
			</div>
			<!-- Skills Hub Link -->
			{#if showSearch}
				<div class="text-sm text-muted-foreground">
					{m.skills_hub_hint_prefix()}
					<button
						type="button"
						class="inline-flex items-center gap-1 text-violet-500 hover:text-violet-600 hover:underline cursor-pointer"
						onclick={() =>
							window.electronAPI.windowService.handleNavigateToUrl(
								"302 Skills Hub",
								"skillsHub",
								"https://skills.302.ai",
							)}
					>
						<ShoppingBag class="h-4 w-4" />
						{m.skills_hub_link_text()}
					</button>
					{m.skills_hub_hint_suffix()}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Skills Grid -->
	{#if loading}
		<div class="flex h-48 items-center justify-center text-primary">
			<LdrsLoader type="dot-pulse" size={40} />
		</div>
	{:else}
		<div class="grid gap-4 grid-cols-[repeat(auto-fill,minmax(320px,1fr))]">
			{#each filteredSkills as item, index (`${item.name}-${item.isBuiltin ? "builtin" : "user"}-${index}`)}
				{@const usedSkill = usedSkills.find((s) => s.name === item.name)}
				{@const displaySkill = usedSkill
					? { ...item, ...usedSkill, is_favorite: item.is_favorite ?? false }
					: item}
				<SkillCard
					skill={displaySkill}
					isBuiltin={!!item.isBuiltin}
					is_favorite={item.is_favorite ?? false}
					isUsed={!!usedSkill}
					onSelect={handleSelectSkill}
					{onUse}
					{onRemove}
					onEdit={isOpenClawBundledSkill(item) ? undefined : handleEdit}
					onDownload={handleDownload}
					onDelete={isOpenClawBundledSkill(item) ? undefined : handleDelete}
					downloading={downloadingSkills.has(item.name)}
					favoriteLoading={favoritingSkills.has(item.name)}
					onFavoriteToggle={canFavoriteSkill(
						currentCodeAgentType,
						item.isBuiltin ?? false,
					)
						? handleFavoriteToggle
						: undefined}
					{onForceUseToggle}
				/>
			{/each}
		</div>
		<!-- Empty State -->
		{#if filteredSkills.length === 0}
			<div
				class="text-muted-foreground flex flex-col items-center justify-center py-12 text-center"
			>
				<p>{m.no_search_results()}</p>
			</div>
		{/if}
	{/if}
</div>

<!-- Detail Dialog -->
<SkillDetailDialog
	bind:open={detailDialogOpen}
	skill={selectedSkill}
	downloading={selectedSkill ? downloadingSkills.has(selectedSkill.name) : false}
	{onUse}
	onEdit={selectedSkill && !isOpenClawBundledSkill(selectedSkill) ? handleEdit : undefined}
	onDownload={handleDownload}
/>

<!-- Create Dialog -->
<SkillCreateDialog bind:open={createDialogOpen} onCreate={() => onRefresh?.()} />

<!-- Edit Dialog -->
<SkillEditDialog bind:open={editDialogOpen} skill={editingSkill} onSave={() => onRefresh?.()} />

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.skills_confirm_delete_title()}</Dialog.Title>
		</Dialog.Header>
		<Dialog.Description>
			{m.skills_confirm_delete_message({ name: deletingSkill?.name || "" })}
		</Dialog.Description>
		<Dialog.Footer>
			<Button
				variant="outline"
				onclick={() => (deleteDialogOpen = false)}
				disabled={isDeleting}
			>
				{m.text_button_cancel()}
			</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={isDeleting}>
				{m.text_button_delete()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
