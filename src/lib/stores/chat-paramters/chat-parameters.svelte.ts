import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type {
	ChatParameters as ChatParametersType,
	ChatVariable,
} from "@shared/storage/chat-parameters";
import type { LexicalEditor } from "lexical";
import { SvelteSet } from "svelte/reactivity";

// Get threadId from window.tab (same logic as chat-state.svelte.ts)
const tab = window?.tab ?? null;
const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

const VALID_BUILTIN_TYPES = ["universal-type", "terse-and-effective-type", "deep-thinking-type"];

const initialChatParameters: ChatParametersType = {
	systemPromptVariables: [],
	systemPromptMap: {},
	systemPromptContent: "",
	systemPromptPresetType: "universal-type",
	systemPromptRawJson:
		'{"root":{"children":[{"children":[],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
	userPromptTemplateVariables: ["input"],
	userPromptTemplateMap: {},
	userPromptTemplateContent: "{{#input#}}",
	userPromptTemplateRawJson:
		'{"root":{"children":[{"children":[{"type":"variable-value","version":1,"variable":"input"}],"direction":null,"format":"","indent":0,"type":"paragraph","version":1,"textFormat":0,"textStyle":""}],"direction":null,"format":"","indent":0,"type":"root","version":1}}',
};

export const persistedChatParametersState = new PersistedState<ChatParametersType>(
	"app-chat-parameters:" + threadId,
	initialChatParameters,
);

function isValidPresetType(type: string): boolean {
	return VALID_BUILTIN_TYPES.includes(type) || type.startsWith("custom-");
}

class ChatParameters {
	#isPresetUpdate = $state(false);

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
		if (!isValidPresetType(type)) {
			return "universal-type";
		}
		return type;
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

	clearUserPromptTemplateMap() {
		this.#updateState({ userPromptTemplateMap: {} });
	}

	startPresetChange(type: string) {
		this.#isPresetUpdate = true;
		this.#updateState({ systemPromptPresetType: type });
	}

	private extractVariablesFromRawJson(rawJson: string): ChatVariable[] {
		try {
			const parsed = JSON.parse(rawJson);
			const variableSet = new SvelteSet<ChatVariable>();

			const findVariables = (node: unknown) => {
				if (!node || typeof node !== "object") return;

				if (
					"type" in node &&
					node.type === "variable-value" &&
					"variable" in node &&
					typeof node.variable === "string"
				) {
					variableSet.add(node.variable as ChatVariable);
				}

				if ("children" in node && Array.isArray(node.children)) {
					for (const child of node.children) {
						findVariables(child);
					}
				}
			};

			findVariables(parsed.root);
			return Array.from(variableSet);
		} catch {
			return [];
		}
	}

	handleEditorChange(content: string, rawJson: string, isSystemPrompt: boolean) {
		let updates: Partial<ChatParametersType> = {};

		if (isSystemPrompt) {
			updates = {
				systemPromptContent: content,
				systemPromptRawJson: rawJson,
				systemPromptVariables: this.extractVariablesFromRawJson(rawJson),
				// Reset cached variable map when content changes
				systemPromptMap: {},
			};

			if (this.#isPresetUpdate) {
				this.#isPresetUpdate = false;
			}
		} else {
			updates = {
				userPromptTemplateContent: content,
				userPromptTemplateRawJson: rawJson,
				userPromptTemplateVariables: this.extractVariablesFromRawJson(rawJson),
				userPromptTemplateMap: {},
			};
		}

		this.#updateState(updates);
	}
}

export const chatParameters = new ChatParameters();
