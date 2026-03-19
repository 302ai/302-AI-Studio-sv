import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import type { OpenClawConfig } from "@shared/storage/openclaw";
import { clone } from "es-toolkit/compat";

const tab = window.tab ?? null;
const threadId =
	tab &&
	typeof tab === "object" &&
	"threadId" in tab &&
	typeof tab.threadId === "string" &&
	tab.threadId
		? tab.threadId
		: "shell";
const openclawConfig = window.openclawConfig;

function getInitialData() {
	if (openclawConfig) {
		return clone(openclawConfig as OpenClawConfig);
	}
	const initialData: OpenClawConfig = {
		feishuSessionId: "",
		agentId: "",
	};
	return initialData;
}

export const persistedOpenclawConfigState = new PersistedState<OpenClawConfig>(
	"OpenClawStorage:openclaw-config-state" + "-" + threadId,
	getInitialData(),
);

class OpenClawConfigState {
	feishuSessionId = $derived(persistedOpenclawConfigState.current?.feishuSessionId ?? "");
	agentId = $derived(persistedOpenclawConfigState.current?.agentId ?? "");

	#updateState(partial: Partial<OpenClawConfig>): void {
		persistedOpenclawConfigState.current = {
			...(persistedOpenclawConfigState.current ?? getInitialData()),
			...partial,
		};
	}

	updateFeishuSessionId(sessionId: string) {
		this.#updateState({ feishuSessionId: sessionId });
	}

	updateAgentId(agentId: string) {
		this.#updateState({ agentId });
	}

	async updateBindings() {
		await window.electronAPI.openClawService.applyOpenClawBindingsConfig(threadId);
	}
}

export const openclawConfigState = new OpenClawConfigState();
