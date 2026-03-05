import { PersistedState } from "$lib/hooks/persisted-state.svelte";
import { m } from "$lib/paraglide/messages.js";
import { type CodeAgentGlobalConfigs, type OpenClawConfig } from "@shared/storage/code-agent";
import { toast } from "svelte-sonner";
import { persistedProviderState } from "../provider-state.svelte";

function getInitialData() {
	const initialData = {
		apiKey: "",
		autoDeploy: true,
		notificationsEnabled: false,
		lastVibeMode: "remote" as const,
		openClawConfig: {
			"fei-shu": { appId: "", appSecret: "" },
		},
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
	openClawConfig = $derived.by(() => {
		return (
			persistedCodeAgentGlobalConfigsState.current?.openClawConfig ??
			getInitialData().openClawConfig
		);
	});

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

	updateOpenClawConfig(config: OpenClawConfig) {
		this.#updateState({ openClawConfig: config });
	}
}

export const codeAgentGlobalConfigsState = new CodeAgentGlobalConfigsState();
