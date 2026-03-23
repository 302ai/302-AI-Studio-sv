<script lang="ts">
	import { m } from "$lib/paraglide/messages";
	import { skillsPanelState } from "$lib/stores/skills-panel-state.svelte";
	import { FileEdit, Link, MessageSquareText, Package } from "@lucide/svelte";
	import type { Component } from "svelte";

	interface CreateOption {
		id: "manual" | "upload" | "github" | "history";
		icon: Component;
		titleKey: () => string;
		descKey: () => string;
	}

	const createOptions: CreateOption[] = [
		{
			id: "manual",
			icon: FileEdit,
			titleKey: () => m.skills_create_manual(),
			descKey: () => m.skills_create_manual_desc(),
		},
		{
			id: "upload",
			icon: Package,
			titleKey: () => m.skills_create_upload(),
			descKey: () => m.skills_create_upload_desc(),
		},
		{
			id: "github",
			icon: Link,
			titleKey: () => m.skills_create_github(),
			descKey: () => m.skills_create_github_desc(),
		},
		{
			id: "history",
			icon: MessageSquareText,
			titleKey: () => m.skills_create_history(),
			descKey: () => m.skills_create_history_desc(),
		},
	];

	function handleSelectOption(optionId: CreateOption["id"]) {
		skillsPanelState.goToCreateMethod(optionId);
	}
</script>

<div class="px-6 py-6">
	<p class="text-muted-foreground mb-4 text-sm">{m.skills_create_select_method()}</p>

	<div class="grid grid-cols-2 gap-4">
		{#each createOptions as option (option.id)}
			<button
				type="button"
				class="flex flex-col items-center gap-2 rounded-xl border bg-transparent p-6 transition-colors hover:border-[#8B5CF6] hover:bg-[#F5F3FF] dark:hover:bg-violet-950/50"
				onclick={() => handleSelectOption(option.id)}
			>
				<div
					class="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-xl"
				>
					<option.icon class="h-6 w-6" />
				</div>
				<span class="text-foreground text-sm font-semibold">{option.titleKey()}</span>
				<span class="text-muted-foreground text-xs text-center">{option.descKey()}</span>
			</button>
		{/each}
	</div>
</div>
