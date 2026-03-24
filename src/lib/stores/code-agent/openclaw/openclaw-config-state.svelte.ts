import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { claudeCodeAgentState } from "$lib/stores/code-agent/claude-code-state.svelte";
import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
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
		telegramBotId: "",
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
	telegramBotId = $derived(persistedOpenclawConfigState.current?.telegramBotId ?? "");
	agentId = $derived(persistedOpenclawConfigState.current?.agentId ?? "");

	currentOcAgentId = $derived.by(() => {
		const sessionId = claudeCodeAgentState.currentSessionId;
		if (!sessionId) return "";
		const session = localClaudeCodeSandboxState.sessions.find((s) => s.session_id === sessionId);
		return session?.oc_agent_id ?? "";
	});

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

	batchUpdater() {
		const value: Partial<OpenClawConfig> = {};
		const obj = {
			update: <T extends keyof OpenClawConfig>(key: T, v: OpenClawConfig[T]) => {
				value[key] = v;
				return obj;
			},
			apply: async () => {
				this.#updateState(value);
				await persistedOpenclawConfigState.flush();
			},
		};
		return obj;
	}

	async updateBindings() {
		this.updateAgentId(this.currentOcAgentId);
		await persistedOpenclawConfigState.flush();
		await window.electronAPI.openClawService.applyOpenClawBindingsConfig(threadId);
	}
}

export const openclawConfigState = new OpenClawConfigState();
