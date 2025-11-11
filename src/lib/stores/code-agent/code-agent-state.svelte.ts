import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { CodeAgentConfigMetadata } from "@shared/storage/code-agent";

const tab = window.tab ?? null;

const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";

export const persistedCodeAgentConfigState = new PersistedState<CodeAgentConfigMetadata>(
	"CodeAgentStorage:code-agent-config-state" + "-" + threadId,
	{
		enabled: false,
		threadId: threadId,
		type: "remote",
		currentAgentId: "",
	},
);

class CodeAgentState {
	enabled = $derived(persistedCodeAgentConfigState.current.enabled);
	type = $derived(persistedCodeAgentConfigState.current.type);
	currentAgentId = $derived(persistedCodeAgentConfigState.current.currentAgentId);

	updateState(partial: Partial<CodeAgentConfigMetadata>): void {
		persistedCodeAgentConfigState.current = {
			...persistedCodeAgentConfigState.current,
			...partial,
		};
	}
}

export const codeAgentState = new CodeAgentState();
