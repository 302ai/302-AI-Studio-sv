<script lang="ts">
	import { goto } from "$app/navigation";
	import { editorStateToText, PromptEditor } from "$lib/components/buss/prompt-editor";
	import { UPDATE_CONTENT_COMMAND } from "$lib/components/buss/prompt-editor/plugins/external-update-plugin.svelte";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import {
		getBuiltinPresets,
		isReadonlyBuiltinPresetKey,
		PRESET_SYSTEM_PROMPT_KEYS,
	} from "$lib/constants/preset-phrasing";
	import { m } from "$lib/paraglide/messages";
	import {
		customPresetsStore,
		DEFAULT_USER_PHRASING,
		EMPTY_PHRASING,
	} from "$lib/stores/custom-presets-store.svelte";
	import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
	import { ChevronLeft, Copy } from "@lucide/svelte";
	import type { LexicalEditor } from "lexical";
	import { toast } from "svelte-sonner";

	interface Props {
		mode: "add" | "edit";
		presetId?: string;
	}

	let { mode, presetId }: Props = $props();

	const gotoBack = () => goto("/settings/phrasing-settings");
	const builtinPresets = $derived(getBuiltinPresets());

	let name = $state("");
	let systemPhrasing = $state(EMPTY_PHRASING);
	let userPhrasing = $state(DEFAULT_USER_PHRASING);
	let systemIsInitialized = $state(false);
	let userIsInitialized = $state(false);

	const preset = $derived.by(() => {
		if (mode !== "edit" || !presetId) return undefined;
		return customPresetsStore.getPreset(presetId);
	});

	const builtinPreset = $derived.by(() => {
		if (!presetId) return undefined;
		return builtinPresets.find((item) => item.key === presetId);
	});

	const isBuiltinPreset = $derived(
		presetId
			? PRESET_SYSTEM_PROMPT_KEYS.includes(
					presetId as (typeof PRESET_SYSTEM_PROMPT_KEYS)[number],
				)
			: false,
	);

	const isReadonlyBuiltinPreset = $derived(
		presetId ? isReadonlyBuiltinPresetKey(presetId) : false,
	);
	const title = $derived(
		mode === "add" ? m.phrasing_form_add_title() : m.phrasing_form_edit_title(),
	);

	$effect(() => {
		if (mode === "edit" && presetId && !systemIsInitialized) return;
		if (mode === "edit" && preset) {
			name = preset.name;
			systemPhrasing = preset.systemPhrasing;
			userPhrasing = preset.userPhrasing;
		} else if (mode === "edit" && builtinPreset) {
			name = builtinPreset.name;
			systemPhrasing = builtinPreset.systemPhrasing;
			userPhrasing = builtinPreset.userPhrasing;
		} else if (mode === "add") {
			name = "";
			systemPhrasing = EMPTY_PHRASING;
			userPhrasing = DEFAULT_USER_PHRASING;
		}
	});

	function handleSystemEditorReady(editor: LexicalEditor) {
		if (systemIsInitialized) return;
		systemIsInitialized = true;

		if (mode === "edit" && presetId) {
			if (preset) {
				editor.dispatchCommand(UPDATE_CONTENT_COMMAND, preset.systemPhrasing);
			} else if (builtinPreset) {
				editor.dispatchCommand(UPDATE_CONTENT_COMMAND, builtinPreset.systemPhrasing);
			} else {
				editor.dispatchCommand(UPDATE_CONTENT_COMMAND, EMPTY_PHRASING);
			}
		} else {
			editor.dispatchCommand(UPDATE_CONTENT_COMMAND, EMPTY_PHRASING);
		}
	}

	function handleUserEditorReady(editor: LexicalEditor) {
		if (userIsInitialized) return;
		userIsInitialized = true;

		if (mode === "edit" && preset?.userPhrasing) {
			editor.dispatchCommand(UPDATE_CONTENT_COMMAND, preset.userPhrasing);
		} else if (mode === "edit" && builtinPreset) {
			editor.dispatchCommand(UPDATE_CONTENT_COMMAND, builtinPreset.userPhrasing);
		} else {
			editor.dispatchCommand(UPDATE_CONTENT_COMMAND, DEFAULT_USER_PHRASING);
		}
	}

	function handleCopy() {
		const source = preset ?? builtinPreset;
		if (!source) return;
		const newPreset = customPresetsStore.addPreset(
			`${source.name} copy`,
			source.systemPhrasing,
			source.userPhrasing,
		);
		toast.success(m.phrasing_copy_success());
		goto(`/settings/phrasing-settings/phrasing-form/${newPreset.key}`);
	}

	function getEditorText(rawJson: string) {
		try {
			return editorStateToText(JSON.parse(rawJson)).trim();
		} catch {
			return "";
		}
	}

	async function copyPromptText(rawJson: string) {
		const text = getEditorText(rawJson);
		if (!text) {
			toast.error(m.toast_copied_failed());
			return;
		}

		try {
			await navigator.clipboard.writeText(text);
			toast.success(m.toast_copied_success());
		} catch {
			toast.error(m.toast_copied_failed());
		}
	}

	function handleSave() {
		if (!name.trim()) {
			toast.error(m.phrasing_name_required());
			return;
		}

		if (mode === "edit" && isReadonlyBuiltinPreset) {
			return;
		}

		if (mode === "edit" && isBuiltinPreset && builtinPreset) {
			customPresetsStore.savePreset(presetId!, name.trim(), systemPhrasing, userPhrasing);
		} else {
			const key = mode === "edit" && presetId ? presetId : `custom-${Date.now()}`;
			customPresetsStore.savePreset(key, name.trim(), systemPhrasing, userPhrasing);
		}

		toast.success(m.phrasing_save_success());
		goto("/settings/phrasing-settings");
	}

	function handleDelete() {
		if (mode !== "edit" || !presetId || isReadonlyBuiltinPreset) return;
		if (preferencesSettings.defaultPhrasing === presetId) {
			preferencesSettings.setDefaultPhrasing("empty");
		}
		customPresetsStore.deletePreset(presetId);
		toast.success(m.phrasing_delete_success());
		goto("/settings/phrasing-settings");
	}
</script>

{#snippet systemCopyBtn()}
	<button
		type="button"
		class="cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
		onclick={() => copyPromptText(systemPhrasing)}
	>
		<Copy size={12} />
	</button>
{/snippet}

{#snippet userCopyBtn()}
	<button
		type="button"
		class="cursor-pointer rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
		onclick={() => copyPromptText(userPhrasing)}
	>
		<Copy size={12} />
	</button>
{/snippet}

<div class="flex justify-between items-center">
	<button class="flex items-center cursor-pointer hover:text-primary" onclick={gotoBack}>
		<ChevronLeft />
		<p>{m.phrasing_back()}</p>
	</button>
	<div class="flex items-center space-x-2">
		{#if mode === "edit" && isReadonlyBuiltinPreset}
			<Button onclick={handleCopy}>{m.phrasing_copy()}</Button>
		{:else}
			{#if mode === "edit"}
				<Button variant="destructive" onclick={handleDelete}>删除</Button>
			{/if}
			<Button onclick={handleSave}>保存</Button>
		{/if}
	</div>
</div>

<div class="gap-settings-gap flex flex-col">
	<Label id="presetName" class="text-label-fg text-sm">{title}</Label>
	<Input
		id="presetName"
		placeholder={m.phrasing_name_required()}
		class="rounded-settings-item bg-settings-item-bg hover:ring-ring hover:ring-1"
		bind:value={name}
		disabled={isReadonlyBuiltinPreset}
	/>
</div>

<div class:opacity-70={isReadonlyBuiltinPreset}>
	<div class="gap-settings-gap flex flex-col">
		<PromptEditor
			tips="为本轮对话定全局规则和角色，如语气、身份、禁止事项等，对所有用户消息生效。"
			label={m.text_system_prompt()}
			readonly={isReadonlyBuiltinPreset}
			class="min-h-[150px]"
			onEditorReady={handleSystemEditorReady}
			onchange={(_content, rawJson) => {
				systemPhrasing = rawJson;
			}}
			right={systemCopyBtn}
		/>
	</div>

	<div class="gap-settings-gap flex flex-col">
		<PromptEditor
			tips={`为每条用户输入套用统一格式或前后缀内容，可使用占位符（如 {{input}}）插入用户实际输入。`}
			readonly={isReadonlyBuiltinPreset}
			class="min-h-[150px]"
			label={m.text_user_prompt_tempalte()}
			onEditorReady={handleUserEditorReady}
			onchange={(_content, rawJson) => {
				userPhrasing = rawJson;
			}}
			right={userCopyBtn}
		/>
	</div>
</div>

<div class="text-muted-foreground text-sm mt-4">
	<p>{m.phrasing_supported_variables()}</p>
	<p>
		{m.phrasing_supported_variables_desc_1({
			input: "{input}",
			date: "{date}",
			time: "{time}",
		})}
	</p>
	<p>
		{m.phrasing_supported_variables_desc_2({
			datetime: "{datetime}",
			now: "{now}",
			model_id: "{model_id}",
		})}
	</p>
</div>
