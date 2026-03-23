<script lang="ts">
	import Button from "$lib/components/ui/button/button.svelte";
	import * as Dialog from "$lib/components/ui/dialog";
	import { m } from "$lib/paraglide/messages";
	import { generalSettings } from "$lib/stores/general-settings.state.svelte";
	import { isOpenClawBundledSkill } from "$lib/utils/skill";
	import { ChevronLeft, Loader2, X, Zap } from "@lucide/svelte";
	import type { Skill } from "@shared/types";

	interface Props {
		open: boolean;
		skill: Skill | null;
		downloading?: boolean;
		onOpenChange?: (open: boolean) => void;
		onUse?: (skill: Skill) => void;
		onEdit?: (skill: Skill) => void;
		onDownload?: (skill: Skill) => void;
	}

	let {
		open = $bindable(false),
		skill = null,
		downloading = false,
		onOpenChange,
		onUse,
		onEdit,
		onDownload,
	}: Props = $props();

	function handleClose() {
		open = false;
		onOpenChange?.(false);
	}

	function handleEdit() {
		if (skill && onEdit) {
			onEdit(skill);
			handleClose();
		}
	}

	function handleDownload() {
		if (skill && onDownload) {
			onDownload(skill);
		}
	}

	const showFooter = $derived(!!onUse || !!onEdit || !!onDownload);
	const isOpenClawBundled = $derived(isOpenClawBundledSkill(skill));
	const description = $derived(
		skill
			? generalSettings.language === "zh" && skill.description_zh
				? skill.description_zh
				: skill.description
			: "",
	);
</script>

<Dialog.Root bind:open onOpenChange={(v) => onOpenChange?.(v)}>
	<Dialog.Content class="min-w-md rounded-2xl p-0" showCloseButton={false}>
		<!-- Header -->
		<div class="grid grid-cols-[1fr_auto_1fr] items-center border-b px-4 py-3">
			<div class="flex justify-start">
				<Button
					variant="ghost"
					class="text-[14px] flex items-center text-center text-muted-foreground"
					size="sm"
					onclick={handleClose}
				>
					<ChevronLeft class="h-4 w-4" />
					{m.skills_back()}
				</Button>
			</div>
			<span class="text-foreground text-base font-semibold">{m.skills_detail_title()}</span>
			<div class="flex justify-end">
				<Button variant="ghost" size="icon" class="h-8 w-8" onclick={handleClose}>
					<X class="h-4 w-4" />
				</Button>
			</div>
		</div>

		<!-- Content -->
		<div class="flex flex-col items-center px-6 py-8">
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

		<!-- Footer -->
		{#if showFooter}
			<div class="flex gap-3 border-t px-6 py-4">
				{#if onDownload && !isOpenClawBundled}
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
				{/if}
				{#if onEdit && !isOpenClawBundled}
					<Button class="flex-1" onclick={handleEdit}>
						{m.text_button_edit()}
					</Button>
				{/if}
			</div>
		{/if}
	</Dialog.Content>
</Dialog.Root>
