import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { preferencesSettings } from "$lib/stores/preferences-settings.state.svelte";
import type {
	ChatParameters as ChatParametersType,
	ChatVariable,
} from "@shared/storage/chat-parameters";
import type { LexicalEditor } from "lexical";
import { SvelteSet } from "svelte/reactivity";

const tab = window?.tab ?? null;
const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

const VALID_BUILTIN_TYPES = [
	"empty",
	"universal-type",
	"terse-and-effective-type",
	"deep-thinking-type",
];

const getDefaultSystemPromptPresetType = (): string => {
	const fallback = preferencesSettings.defaultPhrasing;
	return isValidPresetType(fallback) ? fallback : "empty";
};

const createInitialChatParameters = (): ChatParametersType => ({
	systemPromptVariables: [],
	systemPromptMap: {},
	systemPromptContent: "",
	systemPromptPresetType: "",
	systemPromptRawJson:
		'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
	userPromptTemplateVariables: ["input"],
	userPromptTemplateMap: {},
	userPromptTemplateContent: "{{#input#}}",
	userPromptTemplateRawJson:
		'{"root":{"children":[{"children":[{"type":"variable-value","version":1,"variable":"input"}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
});

export const persistedChatParametersState = new PersistedState<ChatParametersType>(
	"app-chat-parameters:" + threadId,
	createInitialChatParameters(),
);

function isValidPresetType(type: string): boolean {
	return VALID_BUILTIN_TYPES.includes(type) || type.startsWith("custom-");
}

class ChatParameters {
	#isPresetUpdate = $state(false);
	#hasEnsuredInitialization = false;

	systemPromptEditorRef = $state<LexicalEditor | null>(null);
	userPromptTemplateEditorRef = $state<LexicalEditor | null>(null);

	systemPromptVariables = $derived.by(
		() => persistedChatParametersState.current.systemPromptVariables,
	);
	systemPromptMap = $derived.by(() => persistedChatParametersState.current.systemPromptMap);
	systemPromptContent = $derived.by(
		() => persistedChatParametersState.current.systemPromptContent,
	);
	systemPromptPresetType = $derived.by(() => {
		const type = persistedChatParametersState.current.systemPromptPresetType;
		return isValidPresetType(type) ? type : "empty";
	});
	systemPromptRawJson = $derived.by(
		() => persistedChatParametersState.current.systemPromptRawJson,
	);

	userPromptTemplateVariables = $derived.by(
		() => persistedChatParametersState.current.userPromptTemplateVariables,
	);
	userPromptTemplateMap = $derived.by(
		() => persistedChatParametersState.current.userPromptTemplateMap,
	);
	userPromptTemplateContent = $derived.by(
		() => persistedChatParametersState.current.userPromptTemplateContent,
	);
	userPromptTemplateRawJson = $derived.by(
		() => persistedChatParametersState.current.userPromptTemplateRawJson,
	);

	#updateState(partial: Partial<ChatParametersType>): void {
		persistedChatParametersState.current = {
			...persistedChatParametersState.current,
			...partial,
		};
	}

	ensureInitialized() {
		if (this.#hasEnsuredInitialization) return;
		if (!persistedChatParametersState.isHydrated || !preferencesSettings.isHydrated) return;

		const current = persistedChatParametersState.current;
		const hasPreset = Boolean(current.systemPromptPresetType);
		const hasContent = Boolean(current.systemPromptContent);
		const hasVariables = current.systemPromptVariables.length > 0;

		if (hasPreset || hasContent || hasVariables) {
			this.#hasEnsuredInitialization = true;
			return;
		}

		this.#updateState({
			systemPromptPresetType: getDefaultSystemPromptPresetType(),
		});
		this.#hasEnsuredInitialization = true;
	}

	setSystemPromptEditorRef(editor: LexicalEditor | null) {
		this.systemPromptEditorRef = editor;
	}

	setUserPromptTemplateEditorRef(editor: LexicalEditor | null) {
		this.userPromptTemplateEditorRef = editor;
	}

	updateSystemPromptMap(newValues: Record<string, string>) {
		const currentMap = persistedChatParametersState.current.systemPromptMap;
		this.#updateState({
			systemPromptMap: { ...currentMap, ...newValues },
		});
	}

	updateUserPromptTemplateMap(newValues: Record<string, string>) {
		const currentMap = persistedChatParametersState.current.userPromptTemplateMap;
		this.#updateState({
			userPromptTemplateMap: { ...currentMap, ...newValues },
		});
	}

	clearSystemPromptMap() {
		this.#updateState({ systemPromptMap: {} });
	}

	setSystemPromptContent(content: string) {
		this.#updateState({
			systemPromptContent: content,
			systemPromptPresetType: "empty",
			systemPromptVariables: [],
			systemPromptMap: {},
		});
	}

	clearUserPromptTemplateMap() {
		this.#updateState({ userPromptTemplateMap: {} });
	}

	setIsPresetUpdate(value: boolean) {
		this.#isPresetUpdate = value;
	}

	startPresetChange(type: string) {
		this.#isPresetUpdate = true;
		this.#updateState({
			systemPromptPresetType: type,
			systemPromptMap: {},
		});
	}

	handleEditorChange(content: string, rawJson: string, isSystemPrompt: boolean) {
		const extractedVariables = this.extractVariablesFromRawJson(rawJson);

		if (isSystemPrompt) {
			const updates: Partial<ChatParametersType> = {
				systemPromptContent: content,
				systemPromptRawJson: rawJson,
				systemPromptVariables: extractedVariables,
			};

			if (this.#isPresetUpdate) {
				this.#isPresetUpdate = false;
			} else {
				updates.systemPromptMap = {};
			}

			this.#updateState(updates);
		} else {
			this.#updateState({
				userPromptTemplateContent: content,
				userPromptTemplateRawJson: rawJson,
				userPromptTemplateVariables: extractedVariables,
				userPromptTemplateMap: {},
			});
		}
	}

	extractVariablesFromRawJson(rawJson: string): ChatVariable[] {
		const varSet = new SvelteSet<ChatVariable>();
		const matchAll = rawJson.matchAll(/"variable":"(.*?)"/g);
		for (const match of matchAll) {
			if (match[1]) {
				varSet.add(match[1] as ChatVariable);
			}
		}
		return Array.from(varSet);
	}
}

export const chatParameters = new ChatParameters();
