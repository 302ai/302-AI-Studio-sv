import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages.js";
import { type CodeAgentGlobalConfigs } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { persistedProviderState } from "../provider-state.svelte";

function getInitialData() {
	const initialData = {
		apiKey: "",
		autoDeploy: true,
		notificationsEnabled: false,
		lastVibeMode: "remote" as const,
		feishu: { appId: "", appSecret: "" },
		dingtalk: { clientId: "", clientSecret: "" },
		qqbot: { appId: "", clientSecret: "" },
		wecom: { botId: "", secret: "" },
		telegram: { botToken: "", allowFrom: [] },
	};
	return initialData;
}

export const persistedCodeAgentGlobalConfigsState = new PersistedState<CodeAgentGlobalConfigs>(
	"CodeAgentStorage:code-agent-global-configs",
	getInitialData(),
);

class CodeAgentGlobalConfigsState {
	apiKey = $derived(persistedCodeAgentGlobalConfigsState.current?.apiKey ?? "");
	autoDeploy = $derived(persistedCodeAgentGlobalConfigsState.current?.autoDeploy ?? true);
	notificationsEnabled = $derived(
		persistedCodeAgentGlobalConfigsState.current?.notificationsEnabled ?? false,
	);
	lastVibeMode = $derived(persistedCodeAgentGlobalConfigsState.current?.lastVibeMode ?? "remote");
	isHydrated = $derived(persistedCodeAgentGlobalConfigsState.isHydrated);
	feishu = $derived(
		persistedCodeAgentGlobalConfigsState.current.feishu ?? { appId: "", appSecret: "" },
	);
	dingtalk = $derived(
		persistedCodeAgentGlobalConfigsState.current.dingtalk ?? { clientId: "", clientSecret: "" },
	);
	qqbot = $derived(
		persistedCodeAgentGlobalConfigsState.current.qqbot ?? { appId: "", clientSecret: "" },
	);
	wecom = $derived(persistedCodeAgentGlobalConfigsState.current.wecom ?? { botId: "", secret: "" });
	telegram = $derived(
		persistedCodeAgentGlobalConfigsState.current.telegram ?? { botToken: "", allowFrom: [] },
	);

	constructor() {
		$effect.root(() => {
			$effect(() => {
				if (
					persistedCodeAgentGlobalConfigsState.isHydrated &&
					persistedProviderState.isHydrated &&
					!persistedCodeAgentGlobalConfigsState.current?.apiKey
				) {
					const defaultKey = this.getDefaultApiKey();
					if (defaultKey) {
						this.updateApiKey(defaultKey);
					}
				}
			});
		});
	}

	#updateState(partial: Partial<CodeAgentGlobalConfigs>): void {
		persistedCodeAgentGlobalConfigsState.current = {
			...(persistedCodeAgentGlobalConfigsState.current ?? getInitialData()),
			...partial,
		};
	}

	getDefaultApiKey() {
		const _302AIProvider = persistedProviderState.current?.find((p) => p.apiType === "302ai");
		return _302AIProvider?.apiKey ?? "";
	}

	updateApiKey(apiKey: string) {
		this.#updateState({ apiKey });
	}

	resetApiKey() {
		this.#updateState({ apiKey: this.getDefaultApiKey() });
	}

	toggleAutoDeploy() {
		this.#updateState({ autoDeploy: !this.autoDeploy });
	}

	updateFeishuConfig(config: { appId: string; appSecret: string }) {
		this.#updateState({ feishu: config });
	}

	updateFeishuAppId(appId: string) {
		this.#updateState({ feishu: { ...this.feishu, appId } });
	}

	updateFeishuAppSecret(appSecret: string) {
		this.#updateState({ feishu: { ...this.feishu, appSecret } });
	}

	updateDingtalkClientId(clientId: string) {
		this.#updateState({ dingtalk: { ...this.dingtalk, clientId } });
	}

	updateDingtalkClientSecret(clientSecret: string) {
		this.#updateState({ dingtalk: { ...this.dingtalk, clientSecret } });
	}

	updateQqbotAppId(appId: string) {
		this.#updateState({ qqbot: { ...this.qqbot, appId } });
	}

	updateQqbotClientSecret(clientSecret: string) {
		this.#updateState({ qqbot: { ...this.qqbot, clientSecret } });
	}

	updateWecomBotId(botId: string) {
		this.#updateState({ wecom: { ...this.wecom, botId } });
	}

	updateWecomSecret(secret: string) {
		this.#updateState({ wecom: { ...this.wecom, secret } });
	}

	updateTelegramBotToken(botToken: string) {
		this.#updateState({ telegram: { ...this.telegram, botToken } });
	}

	updateTelegramAllowFrom(allowFrom: string[]) {
		this.#updateState({ telegram: { ...this.telegram, allowFrom } });
	}

	async toggleNotificationsEnabled() {
		const newState = !this.notificationsEnabled;
		this.#updateState({ notificationsEnabled: newState });

		if (newState) {
			const granted = await window.electronAPI.notificationService.requestPermission();
			if (!granted) {
				toast.info(m.toast_notification_permission_required());
			}
		}
	}
}

export const codeAgentGlobalConfigsState = new CodeAgentGlobalConfigsState();
