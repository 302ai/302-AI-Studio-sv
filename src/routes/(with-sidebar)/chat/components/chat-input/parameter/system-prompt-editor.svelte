<script lang="ts" module>
	export const PRESET_SYSTEM_PROMPT = [
		{
			key: "universal-type",
			text: m.text_universal_type(),
		},
		{
			key: "terse-and-effective-type",
			text: m.text_terse_and_effective_type(),
		},
		{
			key: "deep-thinking-type",
			text: m.text_deep_thinking_type(),
		},
	];
</script>

<script lang="ts">
	import { UPDATE_CONTENT_COMMAND } from "$lib/components/buss/prompt-editor/plugins/external-update-plugin.svelte";
	import PromptEditor from "$lib/components/buss/prompt-editor/prompt-editor.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import * as Select from "$lib/components/ui/select/index.js";
	import { m } from "$lib/paraglide/messages";
	import { chatParameters } from "$lib/stores/chat-paramters/chat-parameters.svelte";
	import { customPresetsStore } from "$lib/stores/custom-presets-store.svelte";
	import { CirclePlus, Save } from "@lucide/svelte";
	import type { LexicalEditor } from "lexical";
	import { toast } from "svelte-sonner";
	import deepThinkingType from "./preset-prompt-templates/deep-thinking-type.json";
	import terseAndEffectiveType from "./preset-prompt-templates/terse-and-effective-type.json";
	import universalType from "./preset-prompt-templates/universal-type.json";

	let showAddDialog = $state(false);
	let newPromptName = $state("");
	let isInitialized = $state(false);
	const PRESET_PROMPT_MAP: Record<string, string> = {
		"universal-type": JSON.stringify(universalType),
		"terse-and-effective-type": JSON.stringify(terseAndEffectiveType),
		"deep-thinking-type": JSON.stringify(deepThinkingType),
	};

	const allPresets = $derived.by(() => {
		const builtinKeys = new Set(PRESET_SYSTEM_PROMPT.map((p) => p.key));
		const customOnly = customPresetsStore.presets
			.filter((p) => !builtinKeys.has(p.key))
			.map((p) => ({ key: p.key, text: p.name }));
		return [...PRESET_SYSTEM_PROMPT, ...customOnly];
	});

	const canSave = $derived.by(() => {
		const currentType = chatParameters.systemPromptPresetType;
		const savedPreset = customPresetsStore.getPreset(currentType);

		if (savedPreset) {
			return chatParameters.systemPromptRawJson !== savedPreset.rawJson;
		}

		const isBuiltin = currentType in PRESET_PROMPT_MAP;
		if (isBuiltin) {
			return chatParameters.systemPromptRawJson !== PRESET_PROMPT_MAP[currentType];
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
				customPreset.rawJson,
			);
			return;
		}

		const prompt = PRESET_PROMPT_MAP[newValue];

		chatParameters.startPresetChange(newValue);

		if (prompt) {
			chatParameters.systemPromptEditorRef.dispatchCommand(UPDATE_CONTENT_COMMAND, prompt);
		}
	}

	function handleEditorReady(editor: LexicalEditor) {
		chatParameters.setSystemPromptEditorRef(editor);

		if (isInitialized) return;
		isInitialized = true;

		const currentType = chatParameters.systemPromptPresetType;
		const savedPreset = customPresetsStore.getPreset(currentType);

		if (savedPreset) {
			editor.dispatchCommand(UPDATE_CONTENT_COMMAND, savedPreset.rawJson);
		} else if (currentType in PRESET_PROMPT_MAP) {
			editor.dispatchCommand(UPDATE_CONTENT_COMMAND, PRESET_PROMPT_MAP[currentType]);
		}
	}

	function handleAddPrompt() {
		if (!newPromptName.trim()) return;

		const emptyRawJson =
			'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}';

		const newPreset = customPresetsStore.addPreset(newPromptName.trim(), emptyRawJson);

		chatParameters.startPresetChange(newPreset.key);
		chatParameters.systemPromptEditorRef?.dispatchCommand(UPDATE_CONTENT_COMMAND, emptyRawJson);

		newPromptName = "";
		showAddDialog = false;
	}

	function handleSavePrompt() {
		const currentType = chatParameters.systemPromptPresetType;
		const presetName = allPresets.find((p) => p.key === currentType)?.text || currentType;

		customPresetsStore.savePreset(currentType, presetName, chatParameters.systemPromptRawJson);

		toast.success(m.system_prompt_save_success());
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
				<Select.Trigger class="w-full"
					>{allPresets.find((item) => item.key === chatParameters.systemPromptPresetType)
						?.text}
				</Select.Trigger>
				<Select.Content>
					{#each allPresets as item (item.key)}
						<Select.Item value={item.key} label={item.text} />
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
	<span class="text-primary cursor-pointer hover:underline text-sm"
		>{m.system_prompt_manage_templates()}</span
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
