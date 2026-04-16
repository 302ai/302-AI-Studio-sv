<script lang="ts">
	import { goto } from "$app/navigation";
	import { editorStateToText } from "$lib/components/buss/prompt-editor";
	import SettingSearchInput from "$lib/components/buss/settings/setting-search-input.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as ContextMenu from "$lib/components/ui/context-menu";
	import * as Empty from "$lib/components/ui/empty/index.js";
	import {
		getBuiltinPresets,
		isReadonlyBuiltinPresetKey,
		PRESET_SYSTEM_PROMPT_KEYS,
	} from "$lib/constants/preset-phrasing";
	import { m } from "$lib/paraglide/messages";
	import { customPresetsStore } from "$lib/stores/custom-presets-store.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { cn } from "$lib/utils";
	import { toast } from "svelte-sonner";

	let searchQuery = $state("");

	const builtinPresets = $derived(getBuiltinPresets());

	const allPresets = $derived.by(() => {
		const builtinKeys = new Set<string>(PRESET_SYSTEM_PROMPT_KEYS);
		const customOnly = customPresetsStore.presets.filter((p) => !builtinKeys.has(p.key));
		return [...builtinPresets, ...customOnly]
			.filter((p) => p.name.includes(searchQuery))
			.filter((p) => p.key !== "empty");
	});

	const handleAdd = () => {
		goto("/settings/phrasing-settings/phrasing-form");
	};

	const handleEdit = (key: string) => {
		goto(`/settings/phrasing-settings/phrasing-form/${key}`);
	};

	const handleDelete = (key: string) => {
		if (preferencesSettings.defaultPhrasing === key) {
			preferencesSettings.setDefaultPhrasing("empty");
		}
		customPresetsStore.deletePreset(key);
		toast.success(m.phrasing_delete_success());
	};

	const handleCopy = (preset: (typeof allPresets)[number]) => {
		customPresetsStore.addPreset(
			`${preset.name} copy`,
			preset.systemPhrasing,
			preset.userPhrasing,
		);
		toast.success(m.phrasing_copy_success());
	};

	function getPresetSummary(systemPhrasing: string) {
		try {
			const parsed = JSON.parse(systemPhrasing);
			const text =
				typeof parsed === "string"
					? parsed.replaceAll("\n", " ").trim()
					: editorStateToText(parsed).replaceAll("\n", " ").trim();
			return text || m.phrasing_empty_summary();
		} catch {
			return m.phrasing_empty_summary();
		}
	}
</script>

<div>
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-base font-medium">{m.system_prompt_template_label()}</h2>
			<div class="flex gap-1">
				<Button onclick={handleAdd}>{m.system_prompt_add_tooltip()}</Button>
			</div>
		</div>

		<SettingSearchInput bind:value={searchQuery} placeholder={m.placeholder_search_agent()} />

		<div class={cn("p-2", allPresets.length > 0 && "rounded-lg border bg-muted/20")}>
			{#if allPresets.length === 0}
				<Empty.Root>
					<Empty.Content class="h-[200px] flex flex-col items-center justify-start pt-8">
						<Empty.Description>
							{searchQuery ? m.no_search_results() : m.no_sandboxes()}
						</Empty.Description>
					</Empty.Content>
				</Empty.Root>
			{:else}
				<div class="max-h-[400px] overflow-y-auto pr-1">
					<div class="flex flex-col gap-2">
						{#each allPresets as preset (preset.key)}
							<ContextMenu.Root>
								<ContextMenu.Trigger>
									<button
										class="flex w-full cursor-pointer items-center justify-between rounded-lg bg-muted/50 p-4 transition-colors hover:bg-muted/70"
										onclick={() => handleEdit(preset.key)}
									>
										<div class="flex min-w-0 flex-col gap-1 text-left">
											<span class="font-medium text-sm">{preset.name}</span>
											<span class="truncate text-xs text-muted-foreground">
												{getPresetSummary(preset.systemPhrasing)}
											</span>
										</div>
									</button>
								</ContextMenu.Trigger>
								<ContextMenu.Content>
									<ContextMenu.Item onclick={() => handleCopy(preset)}
										>{m.phrasing_copy()}</ContextMenu.Item
									>
									{#if !isReadonlyBuiltinPresetKey(preset.key)}
										<ContextMenu.Item
											class="text-destructive focus:text-destructive"
											onclick={() => handleDelete(preset.key)}
										>
											{m.text_button_delete
												? m.text_button_delete()
												: "Delete"}
										</ContextMenu.Item>
									{/if}
								</ContextMenu.Content>
							</ContextMenu.Root>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
