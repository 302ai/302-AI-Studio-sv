<script lang="ts">
	import { downloadSkill } from "$lib/api/skills";
	import { deleteSkill, syncSkills } from "$lib/api/skills/base-apis";
	import { LdrsLoader } from "$lib/components/buss/ldrs-loader";
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import Input from "$lib/components/ui/input/input.svelte";
	import ScrollArea from "$lib/components/ui/scroll-area/scroll-area.svelte";
	import { m } from "$lib/paraglide/messages";
	import { codeAgentState } from "$lib/stores/code-agent/code-agent-state.svelte";
	import {
		skillsCategoryState,
		UNCATEGORIZED_SLUG,
	} from "$lib/stores/skills-category-state.svelte";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { isOpenClawBundledSkill } from "$lib/utils/skill";
	import { cn } from "$lib/utils";
	import {
		ChevronRight,
		FolderOpen,
		Grid3x3,
		LayoutGrid,
		Plus,
		RefreshCw,
		Search,
		ShoppingBag,
		Star,
		Trash2,
		X,
		Zap,
	} from "@lucide/svelte";
	import type { Skill } from "@shared/types";
	import { onMount } from "svelte";
	import { toast } from "svelte-sonner";
	import { SvelteMap, SvelteSet } from "svelte/reactivity";
	import SkillCard from "../skill-card.svelte";

	interface Props {
		userSkills: Skill[];
		builtinSkills: Skill[];
		loading?: boolean;
		showUseButton?: boolean;
		singleColumn?: boolean;
		showBorder?: boolean;
		onRefresh?: () => void;
	}

	let {
		userSkills,
		builtinSkills,
		loading = false,
		showUseButton = true,
		singleColumn = false,
		showBorder = true,
		onRefresh,
	}: Props = $props();

	const usedSkills = $derived(codeAgentState.skills);
	const currentSandboxId = $derived(codeAgentState.sandboxId);
	const currentSessionId = $derived(codeAgentState.currentSessionId);
	const currentAgentId = $derived(codeAgentState.currentAgentId);

	let searchQuery = $state("");
	let deleteDialogOpen = $state(false);
	let deletingSkill = $state<Skill | null>(null);
	let isDeleting = $state(false);
	let isSyncing = $state(false);
	let downloadingSkills = new SvelteSet<string>();

	// Category states
	const categories = $derived(skillsCategoryState.categories);
	const selectedCategorySlug = $derived(skillsCategoryState.selectedCategorySlug);
	const isLoadingCategories = $derived(
		skillsCategoryState.isLoadingCategories || skillsCategoryState.isLoadingSkillCategories,
	);

	// View mode: 'flat' (no category grouping) or 'grouped' (group by category)
	let viewMode = $state<"flat" | "grouped">("flat");

	// Combine skills: user skills first, then builtin skills
	const allSkills = $derived<Skill[]>(
		[...userSkills, ...builtinSkills].filter(
			(skill) => !(currentAgentId === "claude-code" && isOpenClawBundledSkill(skill)),
		),
	);

	// Filter by search query
	const searchFilteredSkills = $derived(
		allSkills.filter(
			(item) =>
				item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				item.description.toLowerCase().includes(searchQuery.toLowerCase()),
		),
	);

	// Filter by selected category
	const filteredSkills = $derived.by(() => {
		if (!selectedCategorySlug) {
			return searchFilteredSkills;
		}
		return searchFilteredSkills.filter((skill) => {
			const category = skillsCategoryState.getSkillCategory(skill.name);
			if (selectedCategorySlug === UNCATEGORIZED_SLUG) {
				return category === null || category === undefined;
			}
			return category?.slug === selectedCategorySlug;
		});
	});

	// Group skills by category for grouped view
	const groupedSkills = $derived.by(() => {
		if (viewMode !== "grouped" || selectedCategorySlug) {
			return null;
		}
		const groups = skillsCategoryState.groupSkillsByCategory(searchFilteredSkills);
		// Sort groups: categorized first (alphabetically), uncategorized last
		const sortedEntries = Array.from(groups.entries()).sort(([slugA, a], [slugB, b]) => {
			if (slugA === UNCATEGORIZED_SLUG) return 1;
			if (slugB === UNCATEGORIZED_SLUG) return -1;
			return (a.category?.name ?? "").localeCompare(b.category?.name ?? "");
		});
		return sortedEntries;
	});

	// Calculate local skill counts for each category based on searchFilteredSkills
	const categoryLocalCounts = $derived.by(() => {
		const counts = new SvelteMap<string, number>();
		let uncategorizedCount = 0;

		for (const skill of searchFilteredSkills) {
			const category = skillsCategoryState.getSkillCategory(skill.name);
			if (category?.slug) {
				counts.set(category.slug, (counts.get(category.slug) ?? 0) + 1);
			} else {
				uncategorizedCount++;
			}
		}

		return { counts, uncategorizedCount };
	});

	// Load categories and skill category info on mount
	onMount(() => {
		loadCategoryData();
	});

	// Reload when skills change
	$effect(() => {
		if (allSkills.length > 0) {
			skillsCategoryState.fetchSkillCategories(allSkills);
		}
	});

	async function loadCategoryData() {
		await Promise.all([
			skillsCategoryState.fetchCategories(),
			skillsCategoryState.fetchSkillCategories(allSkills),
		]);
	}

	function handleCategorySelect(slug: string | null) {
		skillsCategoryState.selectCategory(slug);
	}

	function toggleViewMode() {
		viewMode = viewMode === "flat" ? "grouped" : "flat";
		// Clear category filter when switching to grouped view
		if (viewMode === "grouped") {
			skillsCategoryState.clearCategoryFilter();
		}
	}

	// Multi-selection state (must be after filteredSkills)
	let selectedSkills = new SvelteSet<string>();
	const isSelectionMode = $derived(selectedSkills.size > 0);
	const selectableSkills = $derived(
		filteredSkills.filter((skill) => !isOpenClawBundledSkill(skill)),
	);
	const selectedSkillsList = $derived(selectableSkills.filter((s) => selectedSkills.has(s.name)));
	const isAllSelected = $derived(
		selectableSkills.length > 0 && selectedSkills.size === selectableSkills.length,
	);
	// Check if any selected skill can be deleted (non-builtin)
	const canDeleteSelected = $derived(
		selectedSkillsList.some((s) => !s.isBuiltin && !isOpenClawBundledSkill(s)),
	);
	// Check selected skills usage status
	const allSelectedUsed = $derived(
		selectedSkillsList.length > 0 &&
			selectedSkillsList.every((s) => usedSkills.some((u) => u.name === s.name)),
	);
	const anySelectedUsed = $derived(
		selectedSkillsList.some((s) => usedSkills.some((u) => u.name === s.name)),
	);
	// Check selected skills force use status
	const selectedUsedSkills = $derived(
		selectedSkillsList.filter((s) => usedSkills.some((u) => u.name === s.name)),
	);
	const anySelectedForceUsed = $derived(
		selectedUsedSkills.some((s) => {
			const used = usedSkills.find((u) => u.name === s.name);
			return used?.forceUse === true;
		}),
	);
	const anySelectedNotForceUsed = $derived(
		selectedUsedSkills.some((s) => {
			const used = usedSkills.find((u) => u.name === s.name);
			return used?.forceUse !== true;
		}),
	);

	function handleSelectSkill(skill: Skill) {
		skillsPanelState.goToDetail(skill.name);
	}

	function handleNew() {
		skillsPanelState.goToCreateSelect();
	}

	function handleEdit(skill: Skill) {
		if (isOpenClawBundledSkill(skill)) {
			return;
		}

		skillsPanelState.goToEdit(skill.name);
	}

	async function handleDownload(skill: Skill) {
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

	function handleUse(skill: Skill) {
		codeAgentState.handleSkillsUse([skill]);
	}

	function handleRemove(skill: Skill) {
		codeAgentState.handleSkillsRemove([skill]);
	}

	function handleForceUseToggle(skill: Skill, forceUse: boolean) {
		codeAgentState.handleSkillForceUseToggle(skill.name, forceUse);
	}

	// Multi-selection handlers
	function handleSelectionChange(skill: Skill, isSelected: boolean) {
		if (isOpenClawBundledSkill(skill)) {
			return;
		}

		if (isSelected) {
			selectedSkills.add(skill.name);
		} else {
			selectedSkills.delete(skill.name);
		}
	}

	function clearSelection() {
		selectedSkills.clear();
	}

	function selectAll() {
		for (const skill of selectableSkills) {
			selectedSkills.add(skill.name);
		}
	}

	function toggleSelectAll() {
		if (isAllSelected) {
			clearSelection();
		} else {
			selectAll();
		}
	}

	function handleBatchUse() {
		const skillsToUse = selectedSkillsList.filter(
			(s) => !usedSkills.some((u) => u.name === s.name) && !isOpenClawBundledSkill(s),
		);
		if (skillsToUse.length > 0) {
			codeAgentState.handleSkillsUse(skillsToUse);
		}
		clearSelection();
	}

	function handleBatchRemove() {
		const skillsToRemove = selectedSkillsList.filter(
			(s) => usedSkills.some((u) => u.name === s.name) && !isOpenClawBundledSkill(s),
		);
		if (skillsToRemove.length > 0) {
			codeAgentState.handleSkillsRemove(skillsToRemove);
		}
		clearSelection();
	}

	async function handleBatchDelete() {
		const skillsToDelete = selectedSkillsList.filter(
			(s) => !s.isBuiltin && !isOpenClawBundledSkill(s),
		);
		if (skillsToDelete.length === 0) return;

		isDeleting = true;
		const toastId = toast.loading(m.skills_deleting());

		try {
			await deleteSkill({ skill_list: skillsToDelete.map((s) => s.name) });
			codeAgentState.handleSkillsRemove(skillsToDelete);

			toast.dismiss(toastId);
			toast.success(m.skills_delete_success());
			clearSelection();
			onRefresh?.();
		} catch (e) {
			console.error("Failed to delete skills:", e);
			toast.dismiss(toastId);
			toast.error(m.skills_delete_failed());
		} finally {
			isDeleting = false;
		}
	}

	function handleBatchForceUse(forceUse: boolean) {
		// Only apply to skills that need to change
		const skillsToUpdate = selectedUsedSkills.filter((s) => {
			if (isOpenClawBundledSkill(s)) {
				return false;
			}
			const used = usedSkills.find((u) => u.name === s.name);
			return forceUse ? used?.forceUse !== true : used?.forceUse === true;
		});
		for (const skill of skillsToUpdate) {
			codeAgentState.handleSkillForceUseToggle(skill.name, forceUse);
		}
		clearSelection();
	}

	async function handleSync() {
		if (!currentSandboxId) {
			toast.error(m.skills_sync_no_sandbox());
			return;
		}

		isSyncing = true;
		const toastId = toast.loading(m.skills_syncing());

		try {
			const response = await syncSkills({
				sandbox_id: currentSandboxId,
				session_id: currentSessionId || undefined,
			});

			toast.dismiss(toastId);

			if (response.success && response.result.exit_code === 0) {
				toast.success(m.skills_sync_success());
				onRefresh?.();
			} else {
				const errorMsg = response.result.stderr || response.result.error || "Sync failed";
				toast.error(errorMsg);
			}
		} catch (e: unknown) {
			console.error("Failed to sync skills:", e);
			toast.dismiss(toastId);

			// Try to extract error message from response
			let errorMessage = m.skills_sync_failed();
			if (e && typeof e === "object" && "response" in e) {
				try {
					const httpError = e as { response: Response };
					const errorBody = await httpError.response.json();
					if (errorBody?.error?.message) {
						errorMessage = errorBody.error.message;
					}
				} catch {
					// Failed to parse error response
				}
			}
			toast.error(errorMessage);
		} finally {
			isSyncing = false;
		}
	}
</script>

<div class="relative flex h-full flex-col">
	<!-- Search and New Button - Fixed at top -->
	<div class={cn("shrink-0 px-6 py-4", showBorder && "border-b")}>
		<div class="flex items-center gap-3">
			<div class="relative flex-1">
				<Search class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
				<Input
					type="text"
					placeholder={m.skills_search_placeholder()}
					class="border-border bg-transparent pl-9"
					bind:value={searchQuery}
				/>
			</div>
			<!-- View mode toggle -->
			<Button
				variant="outline"
				size="icon"
				class="shrink-0"
				onclick={toggleViewMode}
				title={viewMode === "flat" ? m.skills_view_grouped() : m.skills_view_flat()}
			>
				{#if viewMode === "flat"}
					<LayoutGrid class="h-4 w-4" />
				{:else}
					<Grid3x3 class="h-4 w-4" />
				{/if}
			</Button>
			{#if currentSandboxId && currentSandboxId !== "local"}
				<Button variant="outline" class="gap-2" onclick={handleSync} disabled={isSyncing}>
					<RefreshCw class="h-4 w-4 {isSyncing ? 'animate-spin' : ''}" />
					{m.skills_sync()}
				</Button>
			{/if}
			<Button class="gap-2 bg-violet-500 hover:bg-violet-600" onclick={handleNew}>
				<Plus class="h-4 w-4" />
				{m.skills_new()}
			</Button>
		</div>
		<!-- Skills Hub Link -->
		<div class="flex flex-row items-center mt-3 text-sm text-muted-foreground">
			{m.skills_hub_hint_prefix()}
			<button
				type="button"
				class="flex flex-row mx-1 gap-1 items-center text-primary hover:underline-offset-2 hover:underline cursor-pointer"
				onclick={() =>
					window.electronAPI.windowService.handleNavigateToUrl(
						"302 Skills Hub",
						"skillsHub",
						"https://skills.302.ai",
					)}
			>
				<ShoppingBag class="h-3 w-3" />
				{m.skills_hub_link_text()}
			</button>
			{m.skills_hub_hint_suffix()}
		</div>
	</div>

	<!-- Category Filter Tabs -->
	{#if categories.length > 0 && viewMode === "flat"}
		<div class="shrink-0 border-b">
			<ScrollArea orientation="horizontal" class="w-full">
				<div class="flex items-center gap-1 px-6 py-2">
					<!-- All categories button -->
					<button
						type="button"
						class={cn(
							"shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
							selectedCategorySlug === null
								? "bg-primary text-primary-foreground"
								: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
						onclick={() => handleCategorySelect(null)}
					>
						{m.skills_category_all()}
					</button>
					<!-- Category buttons -->
					{#each categories as category (category.id)}
						{@const localCount = categoryLocalCounts.counts.get(category.slug) ?? 0}
						<button
							type="button"
							class={cn(
								"shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap",
								selectedCategorySlug === category.slug
									? "bg-primary text-primary-foreground"
									: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
							)}
							onclick={() => handleCategorySelect(category.slug)}
						>
							{category.name}
							<span class="ml-1 text-xs opacity-70">({localCount})</span>
						</button>
					{/each}
					<!-- Uncategorized button -->
					<button
						type="button"
						class={cn(
							"shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap",
							selectedCategorySlug === UNCATEGORIZED_SLUG
								? "bg-primary text-primary-foreground"
								: "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
						onclick={() => handleCategorySelect(UNCATEGORIZED_SLUG)}
					>
						{m.skills_category_uncategorized()}
						<span class="ml-1 text-xs opacity-70">({categoryLocalCounts.uncategorizedCount})</span>
					</button>
				</div>
			</ScrollArea>
		</div>
	{/if}

	<!-- Skills Grid - Scrollable -->
	<div class="flex-1 overflow-y-auto min-h-0 px-6 py-4 @container">
		{#if loading || isLoadingCategories}
			<div class="flex h-48 items-center justify-center text-primary">
				<LdrsLoader type="dot-pulse" size={40} />
			</div>
		{:else if viewMode === "grouped" && groupedSkills}
			<!-- Grouped view -->
			{@const groups = groupedSkills}
			{#if groups && groups.length > 0}
				<div class="space-y-6">
					{#each groups as [slug, group] (slug)}
						{@const categoryName = group.category?.name ?? m.skills_category_uncategorized()}
						<div class="space-y-3">
							<!-- Category Header -->
							<div class="flex items-center gap-2">
								<FolderOpen class="h-4 w-4 text-muted-foreground" />
								<h3 class="text-sm font-semibold text-foreground">{categoryName}</h3>
								<span class="text-xs text-muted-foreground">({group.skills.length})</span>
								<button
									type="button"
									class="ml-auto flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer"
									onclick={() => handleCategorySelect(slug)}
								>
									{m.skills_view_category()}
									<ChevronRight class="h-3 w-3" />
								</button>
							</div>
							<!-- Skills Grid -->
							<div
								class="grid gap-4 {singleColumn
									? 'grid-cols-1'
									: 'grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3'}"
							>
								{#each group.skills as item, index (`${item.name}-${item.isBuiltin ? "builtin" : "user"}-${index}`)}
									{@const usedSkill = usedSkills.find((s) => s.name === item.name)}
									<SkillCard
										skill={usedSkill ?? item}
										isBuiltin={!!item.isBuiltin}
										isUsed={!!usedSkill}
										selectable={!isOpenClawBundledSkill(item)}
										selected={selectedSkills.has(item.name)}
										onSelect={handleSelectSkill}
										onSelectionChange={handleSelectionChange}
										onUse={showUseButton ? handleUse : undefined}
										onRemove={showUseButton ? handleRemove : undefined}
										onEdit={isOpenClawBundledSkill(item) ? undefined : handleEdit}
										onDownload={handleDownload}
										onDelete={isOpenClawBundledSkill(item) ? undefined : handleDelete}
										downloading={downloadingSkills.has(item.name)}
										onForceUseToggle={showUseButton ? handleForceUseToggle : undefined}
									/>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Empty State -->
				<div
					class="text-muted-foreground flex flex-col items-center justify-center py-12 text-center"
				>
					<p>{m.no_search_results()}</p>
				</div>
			{/if}
		{:else}
			<!-- Flat view -->
			{@const skills = filteredSkills}
			<div
				class="grid gap-4 {singleColumn
					? 'grid-cols-1'
					: 'grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3'}"
			>
				{#each skills as item, index (`${item.name}-${item.isBuiltin ? "builtin" : "user"}-${index}`)}
					{@const usedSkill = usedSkills.find((s) => s.name === item.name)}
					<SkillCard
						skill={usedSkill ?? item}
						isBuiltin={!!item.isBuiltin}
						isUsed={!!usedSkill}
						selectable={!isOpenClawBundledSkill(item)}
						selected={selectedSkills.has(item.name)}
						onSelect={handleSelectSkill}
						onSelectionChange={handleSelectionChange}
						onUse={showUseButton ? handleUse : undefined}
						onRemove={showUseButton ? handleRemove : undefined}
						onEdit={isOpenClawBundledSkill(item) ? undefined : handleEdit}
						onDownload={handleDownload}
						onDelete={isOpenClawBundledSkill(item) ? undefined : handleDelete}
						downloading={downloadingSkills.has(item.name)}
						onForceUseToggle={showUseButton ? handleForceUseToggle : undefined}
					/>
				{/each}
			</div>
			<!-- Empty State -->
			{#if skills.length === 0}
				<div
					class="text-muted-foreground flex flex-col items-center justify-center py-12 text-center"
				>
					<p>{m.no_search_results()}</p>
				</div>
			{/if}
		{/if}
	</div>

	<!-- Floating Action Bar for Multi-selection -->
	{#if isSelectionMode}
		<div
			class="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 rounded-xl bg-background/98 backdrop-blur-md border border-border/50 shadow-xl px-2 py-1.5 animate-in fade-in slide-in-from-bottom-4 duration-200"
		>
			<!-- Select all checkbox + count -->
			<button
				type="button"
				class="flex items-center gap-1.5 h-7 px-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/15 transition-colors cursor-pointer"
				onclick={toggleSelectAll}
			>
				<div
					class="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors {isAllSelected
						? 'bg-primary border-primary'
						: 'border-primary/50'}"
				>
					{#if isAllSelected}
						<svg class="w-3 h-3 text-primary-foreground" viewBox="0 0 24 24" fill="none">
							<path
								d="M5 12l5 5L20 7"
								stroke="currentColor"
								stroke-width="3"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					{/if}
				</div>
				<span class="text-sm font-semibold tabular-nums"
					>{selectedSkills.size}/{selectableSkills.length}</span
				>
			</button>

			<!-- Action buttons group -->
			<div class="flex items-center gap-0.5 px-1">
				{#if showUseButton}
					{#if !allSelectedUsed}
						<Button
							variant="ghost"
							size="sm"
							class="gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
							onclick={handleBatchUse}
						>
							<Zap class="h-3.5 w-3.5" />
							{m.skills_use()}
						</Button>
					{/if}
					{#if anySelectedUsed}
						<Button
							variant="ghost"
							size="sm"
							class="gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg hover:bg-muted"
							onclick={handleBatchRemove}
						>
							<X class="h-3.5 w-3.5" />
							{m.skills_remove()}
						</Button>
						{#if anySelectedNotForceUsed}
							<Button
								variant="ghost"
								size="sm"
								class="gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
								onclick={() => handleBatchForceUse(true)}
							>
								<Star class="h-3.5 w-3.5" />
								{m.skills_force_use()}
							</Button>
						{/if}
						{#if anySelectedForceUsed}
							<Button
								variant="ghost"
								size="sm"
								class="gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
								onclick={() => handleBatchForceUse(false)}
							>
								<Star class="h-3.5 w-3.5 fill-current" />
								{m.skills_unforce_use()}
							</Button>
						{/if}
					{/if}
				{/if}

				{#if canDeleteSelected}
					<Button
						variant="ghost"
						size="sm"
						class="gap-1.5 h-7 px-2.5 text-xs font-medium rounded-lg text-destructive hover:bg-destructive/10"
						onclick={handleBatchDelete}
						disabled={isDeleting}
					>
						<Trash2 class="h-3.5 w-3.5" />
						{m.text_button_delete()}
					</Button>
				{/if}
			</div>

			<!-- Separator -->
			<div class="h-5 w-px bg-border/60"></div>

			<!-- Close button -->
			<Button
				variant="ghost"
				size="icon"
				class="h-7 w-7 rounded-lg hover:bg-muted"
				onclick={clearSelection}
			>
				<X class="h-4 w-4" />
			</Button>
		</div>
	{/if}
</div>

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
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)} disabled={isDeleting}>
				{m.text_button_cancel()}
			</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={isDeleting}>
				{m.text_button_delete()}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
