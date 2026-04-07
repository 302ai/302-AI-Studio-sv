import { textJsonToEditorState } from "$lib/components/buss/prompt-editor";
import { m } from "$lib/paraglide/messages";
import { DEFAULT_USER_PHRASING, EMPTY_PHRASING } from "$lib/stores/custom-presets-store.svelte";
import type { CustomPreset } from "@shared/storage/chat-parameters";
import deepThinkingType from "../../routes/(with-sidebar)/chat/components/chat-input/parameter/preset-prompt-templates/deep-thinking-type.json";
import terseAndEffectiveType from "../../routes/(with-sidebar)/chat/components/chat-input/parameter/preset-prompt-templates/terse-and-effective-type.json";
import universalType from "../../routes/(with-sidebar)/chat/components/chat-input/parameter/preset-prompt-templates/universal-type.json";

export const PRESET_SYSTEM_PROMPT_KEYS = [
	"302-default",
	"empty",
	"universal-type",
	"terse-and-effective-type",
	"deep-thinking-type",
] as const;

export const READONLY_BUILTIN_PRESET_KEYS = ["302-default", "empty"] as const;

// TODO: 302-default Current empty
export const BUILTIN_SYSTEM_PHRASING_MAP: Record<string, string> = {
	"302-default": textJsonToEditorState("") ?? EMPTY_PHRASING,
	empty: EMPTY_PHRASING,
	"universal-type": JSON.stringify(universalType),
	"terse-and-effective-type": JSON.stringify(terseAndEffectiveType),
	"deep-thinking-type": JSON.stringify(deepThinkingType),
};

export function isBuiltinPresetKey(key: string) {
	return PRESET_SYSTEM_PROMPT_KEYS.includes(key as (typeof PRESET_SYSTEM_PROMPT_KEYS)[number]);
}

export function isReadonlyBuiltinPresetKey(key: string) {
	return READONLY_BUILTIN_PRESET_KEYS.includes(
		key as (typeof READONLY_BUILTIN_PRESET_KEYS)[number],
	);
}

export function getBuiltinPresets(): CustomPreset[] {
	return [
		{
			key: "302-default",
			name: m.text_302_default_type(),
			systemPhrasing: BUILTIN_SYSTEM_PHRASING_MAP["302-default"],
			userPhrasing: DEFAULT_USER_PHRASING,
		},
		{
			key: "empty",
			name: m.text_empty_type(),
			systemPhrasing: BUILTIN_SYSTEM_PHRASING_MAP.empty,
			userPhrasing: DEFAULT_USER_PHRASING,
		},
		{
			key: "universal-type",
			name: m.text_universal_type(),
			systemPhrasing: BUILTIN_SYSTEM_PHRASING_MAP["universal-type"],
			userPhrasing: DEFAULT_USER_PHRASING,
		},
		{
			key: "terse-and-effective-type",
			name: m.text_terse_and_effective_type(),
			systemPhrasing: BUILTIN_SYSTEM_PHRASING_MAP["terse-and-effective-type"],
			userPhrasing: DEFAULT_USER_PHRASING,
		},
		{
			key: "deep-thinking-type",
			name: m.text_deep_thinking_type(),
			systemPhrasing: BUILTIN_SYSTEM_PHRASING_MAP["deep-thinking-type"],
			userPhrasing: DEFAULT_USER_PHRASING,
		},
	];
}
