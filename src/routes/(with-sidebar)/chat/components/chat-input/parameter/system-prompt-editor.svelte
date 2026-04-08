<script lang="ts">
	import { UPDATE_CONTENT_COMMAND } from "$lib/components/buss/prompt-editor/plugins/external-update-plugin.svelte";
	import PromptEditor from "$lib/components/buss/prompt-editor/prompt-editor.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import * as Select from "$lib/components/ui/select/index.js";
	import {
		BUILTIN_SYSTEM_PHRASING_MAP,
		getBuiltinPresets,
		isBuiltinPresetKey,
		isReadonlyBuiltinPresetKey,
		PRESET_SYSTEM_PROMPT_KEYS,
	} from "$lib/constants/preset-phrasing";
	import { m } from "$lib/paraglide/messages";
	import { chatParameters } from "$lib/stores/chat-paramters/chat-parameters.svelte";
	import {
		customPresetsStore,
		DEFAULT_USER_PHRASING,
		EMPTY_PHRASING,
	} from "$lib/stores/custom-presets-store.svelte";
	import { CirclePlus, Save } from "@lucide/svelte";
	import type { LexicalEditor } from "lexical";
	import { toast } from "svelte-sonner";

	let showAddDialog = $state(false);
	let newPromptName = $state("");
	let isInitialized = $state(false);

	const builtinPresets = $derived(getBuiltinPresets());

	const allPresets = $derived.by(() => {
		const builtinKeys = new Set<string>(PRESET_SYSTEM_PROMPT_KEYS);
		const customOnly = customPresetsStore.presets.filter((p) => !builtinKeys.has(p.key));
		return [...builtinPresets, ...customOnly];
	});

	const canSave = $derived.by(() => {
		const currentType = chatParameters.systemPromptPresetType;
		const savedPreset = customPresetsStore.getPreset(currentType);

		if (savedPreset) {
			return chatParameters.systemPromptRawJson !== savedPreset.systemPhrasing;
		}

		if (isBuiltinPresetKey(currentType)) {
			return chatParameters.systemPromptRawJson !== BUILTIN_SYSTEM_PHRASING_MAP[currentType];
		}

		return false;
	});

	function handlePresetChange(newValue: string) {
		if (!newValue || !chatParameters.systemPromptEditorRef) return;

		const customPreset = customPresetsStore.getPreset(newValue);

		if (customPreset) {
			chatParameters.startPresetChange(newValue);
			chatParameters.systemPromptEditorRef.dispatchCommand(
				UPDATE_CONTENT_COMMAND,
				customPreset.systemPhrasing,
			);
			return;
		}

		const prompt = BUILTIN_SYSTEM_PHRASING_MAP[newValue] ?? EMPTY_PHRASING;

		chatParameters.startPresetChange(newValue);
		chatParameters.systemPromptEditorRef.dispatchCommand(UPDATE_CONTENT_COMMAND, prompt);
	}

	function handleEditorReady(editor: LexicalEditor) {
		chatParameters.setSystemPromptEditorRef(editor);
		chatParameters.ensureInitialized();

		if (isInitialized) return;
		isInitialized = true;

		const currentType = chatParameters.systemPromptPresetType;
		const savedPreset = customPresetsStore.getPreset(currentType);

		if (savedPreset) {
			editor.dispatchCommand(UPDATE_CONTENT_COMMAND, savedPreset.systemPhrasing);
		} else {
			const builtinPreset = allPresets.find((preset) => preset.key === currentType);
			if (builtinPreset) {
				editor.dispatchCommand(UPDATE_CONTENT_COMMAND, builtinPreset.systemPhrasing);
			}
		}
	}

	function handleAddPrompt() {
		if (!newPromptName.trim()) return;

		const newPreset = customPresetsStore.addPreset(
			newPromptName.trim(),
			EMPTY_PHRASING,
			DEFAULT_USER_PHRASING,
		);

		chatParameters.startPresetChange(newPreset.key);
		chatParameters.systemPromptEditorRef?.dispatchCommand(
			UPDATE_CONTENT_COMMAND,
			EMPTY_PHRASING,
		);

		newPromptName = "";
		showAddDialog = false;
	}

	function handleSavePrompt() {
		const currentType = chatParameters.systemPromptPresetType;
		const currentPreset = allPresets.find((p) => p.key === currentType);
		const presetName = currentPreset?.name || currentType;
		const userPhrasing = currentPreset?.userPhrasing ?? DEFAULT_USER_PHRASING;

		if (isReadonlyBuiltinPresetKey(currentType)) {
			const newPreset = customPresetsStore.addPreset(
				`${presetName} copy`,
				chatParameters.systemPromptRawJson,
				userPhrasing,
			);
			chatParameters.startPresetChange(newPreset.key);
			toast.success(m.phrasing_copied_as_custom());
			return;
		}

		customPresetsStore.savePreset(
			currentType,
			presetName,
			chatParameters.systemPromptRawJson,
			userPhrasing,
		);

		toast.success(m.system_prompt_save_success());
	}

	async function handleNewSettingsTab(route: string) {
		await window.electronAPI.windowService.handleOpenSettingsWindow(route);
	}
</script>

{#snippet topBar()}
	<div class="w-full">
		<div class="h-9 flex items-center">
			<Label class="text-label-fg">{m.system_prompt_template_label()}</Label>
		</div>
		<div class="flex justify-between items-center w-full space-x-1">
			<Select.Root
				type="single"
				value={chatParameters.systemPromptPresetType}
				onValueChange={handlePresetChange}
			>
				<Select.Trigger class="w-full bg-input"
					>{allPresets.find((item) => item.key === chatParameters.systemPromptPresetType)
						?.name}
				</Select.Trigger>
				<Select.Content>
					{#each allPresets as item (item.key)}
						<Select.Item value={item.key} label={item.name} />
					{/each}
				</Select.Content>
			</Select.Root>
			<div class="flex justify-between items-center">
				<Button
					class="hover:!bg-chat-action-hover"
					variant="ghost"
					size="icon-sm"
					title={m.system_prompt_add_tooltip()}
					onclick={() => (showAddDialog = true)}
				>
					<CirclePlus />
				</Button>
				<Button
					class="hover:!bg-chat-action-hover"
					variant="ghost"
					size="icon-sm"
					title={m.system_prompt_save_tooltip()}
					disabled={!canSave}
					onclick={handleSavePrompt}
				>
					<Save />
				</Button>
			</div>
		</div>
	</div>
{/snippet}

{#snippet right()}
	<!-- svelte-ignore a11y_invalid_attribute -->
	<a
		href="javascript:void(0);"
		class="text-primary cursor-pointer hover:underline text-sm"
		onclick={(e) => {
			e.preventDefault();
			handleNewSettingsTab("/settings/phrasing-settings");
		}}>{m.system_prompt_manage_templates()}</a
	>
{/snippet}

<PromptEditor
	bind:value={chatParameters.systemPromptRawJson}
	class="min-h-[150px]"
	label={m.text_system_prompt()}
	{topBar}
	isSystemPrompt
	onEditorReady={handleEditorReady}
	canReset={false}
	{right}
	onchange={(content, rawJson) => chatParameters.handleEditorChange(content, rawJson, true)}
/>

<Dialog.Root bind:open={showAddDialog}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m.system_prompt_add_dialog_title()}</Dialog.Title>
		</Dialog.Header>
		<div class="py-4">
			<Input
				class="w-92"
				bind:value={newPromptName}
				placeholder={m.system_prompt_add_dialog_placeholder()}
				onkeydown={(e) => {
					if (e.key === "Enter") {
						handleAddPrompt();
					}
				}}
			/>
		</div>
		<Dialog.Footer class="w-full flex justify-between! items-center">
			<Dialog.Close>
				<Button variant="outline">{m.system_prompt_add_dialog_close()}</Button>
			</Dialog.Close>
			<Button onclick={handleAddPrompt}>{m.system_prompt_add_dialog_confirm()}</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
