import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { localClaudeCodeSandboxState } from "$lib/stores/code-agent/local-claude-code-sandbox-state.svelte";
import { type OpenClawConfig, openclawBindingKeys } from "@shared/storage/openclaw";
import { clone } from "es-toolkit/compat";
import { withTimeout } from "es-toolkit/promise";
import { trim } from "es-toolkit/string";
import { codeAgentState } from "../code-agent-state.svelte";

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

	hasConfigs = $derived(
		openclawBindingKeys.some(
			(key) => trim(persistedOpenclawConfigState.current?.[key] ?? "") !== "",
		),
	);

	currentOcAgentId = $derived.by(() => {
		return persistedOpenclawConfigState.current?.agentId ?? this.#resolveOCAgentIdFromSessionId();
	});

	#resolveOCAgentIdFromSessionId(): string {
		const sessionId = codeAgentState.currentSessionId;
		if (!sessionId) return "";
		const session = localClaudeCodeSandboxState.sessions.find((s) => s.session_id === sessionId);
		return session?.oc_agent_id ?? "";
	}

	#updateState(partial: Partial<OpenClawConfig>): void {
		persistedOpenclawConfigState.current = {
			...(persistedOpenclawConfigState.current ?? getInitialData()),
			...partial,
		};
	}

	updateFeishuSessionId(sessionId: string) {
		this.#updateState({ feishuSessionId: sessionId });
	}

	updateOCAgentId(agentId: string) {
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

	async updateOCBindings(ocAgentId: string) {
		if (ocAgentId === "") return;

		this.updateOCAgentId(ocAgentId);

		await persistedOpenclawConfigState.flush();
		await window.electronAPI.openClawService.applyOpenClawBindingsConfig(threadId);
	}

	async bindingAndRestart(ocAgentId: string) {
		await this.updateOCBindings(ocAgentId);

		if (!this.hasConfigs) return;

		await window.electronAPI.localVibeService.restartPodmanMachine();

		let cleanup: (() => void) | undefined;

		return withTimeout(async () => {
			try {
				return await new Promise<void>((resolve, reject) => {
					cleanup = window.electronAPI.onLocalSandboxHealthCheck(
						(data: {
							isOk: boolean;
							isHealth: boolean;
							isOcHealth: boolean;
							error?: string;
							timestamp: number;
						}) => {
							if (!data.isOk) {
								cleanup?.();
								reject(new Error(data.error || "Health check failed (isOk is false)"));
								return;
							}

							if (data.isHealth && data.isOcHealth) {
								cleanup?.();
								resolve();
							}
						},
					);
				});
			} catch (error) {
				cleanup?.();
				throw error;
			}
		}, 60000);
	}
}

export const openclawConfigState = new OpenClawConfigState();
