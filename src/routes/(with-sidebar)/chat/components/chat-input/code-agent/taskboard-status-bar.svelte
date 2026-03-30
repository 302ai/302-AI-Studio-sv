<script lang="ts">
	import LdrsLoader from "$lib/components/buss/ldrs-loader/ldrs-loader.svelte";
	import { Button } from "$lib/components/ui/button";
	import * as Item from "$lib/components/ui/item/index.js";
	import { m } from "$lib/paraglide/messages";
	import { agentPreviewState } from "$lib/stores/agent-preview-state.svelte";
	import { chatState } from "$lib/stores/chat-state.svelte";
	import { codeAgentState } from "$lib/stores/code-agent";
	import { codeAgentSendMessageButtonState } from "$lib/stores/code-agent/code-agent-send-message-button-state.svelte";
	import { codeAgentTaskboardState } from "$lib/stores/code-agent/code-agent-taskboard-state.svelte";
	import { localEnvState } from "$lib/stores/code-agent/local-env-state.svelte";
	import { persistedProviderState } from "$lib/stores/provider-state.svelte";
	import { Pause, Play } from "@lucide/svelte";
	import { toast } from "svelte-sonner";
	import { match } from "ts-pattern";

	let openModelSelect = $state<() => void>();

	// Check if local sandbox is starting (for disabling run button)
	const isLocalSandboxStarting = $derived(
		codeAgentState.type === "local" && localEnvState.sandboxStarting,
	);

	const statusText = $derived.by(() => {
		if (codeAgentTaskboardState.retryExhausted) {
			return `${m.taskboard_bar_status_retry_exhausted()}：`;
		}

		const label = match(codeAgentTaskboardState.taskboardStatus)
			.with("idle", () => m.taskboard_bar_status_idle())
			.with("running", () => m.taskboard_bar_status_running())
			.with("waiting_to_stop", () => m.taskboard_bar_status_waiting_to_stop())
			.with("waiting_for_chat", () => m.taskboard_bar_status_waiting_for_chat())
			.exhaustive();

		if (codeAgentTaskboardState.taskboardStatus === "waiting_for_chat") {
			return `${label}：`;
		}

		const activeTask = codeAgentTaskboardState.activeTask;

		if (activeTask) {
			const progress = m.taskboard_bar_progress({
				current: activeTask.executedCount,
				total: activeTask.number,
			});
			return `${label}${progress}：`;
		}

		return `${label}：`;
	});

	const hasConfiguredProviders = $derived(() => {
		return persistedProviderState.current.some(
			(provider) => provider.enabled && provider.apiKey && provider.apiKey.trim() !== "",
		);
	});

	async function handleGoToModelSettings() {
		await window.electronAPI.windowService.handleOpenSettingsWindow("/settings/model-settings");
	}

	const runTask = async (content: string) => {
		let didSend = false;

		const trySend = (taskContent: string) =>
			match({
				isEmpty: taskContent.trim() === "" && chatState.attachments.length === 0,
				noProviders: !hasConfiguredProviders(),
				noModel: chatState.selectedModel === null,
				isBusy: chatState.isStreaming || chatState.isSubmitted,
				hasLoadingAttachments: chatState.loadingAttachmentIds.size > 0,
			})
				.with({ isEmpty: true }, () => {
					toast.warning(m.toast_empty_message());
					return false;
				})
				.with({ noProviders: true }, () => {
					toast.info(m.toast_no_provider_configured(), {
						action: {
							label: m.text_button_go_to_settings(),
							onClick: () => handleGoToModelSettings(),
						},
					});
					return false;
				})
				.with({ noModel: true }, () => {
					toast.warning(m.toast_no_model(), {
						action: {
							label: m.text_button_select_model(),
							onClick: () => {
								if (!hasConfiguredProviders()) {
									toast.info(m.toast_no_provider_configured(), {
										action: {
											label: m.text_button_go_to_settings(),
											onClick: () => handleGoToModelSettings(),
										},
									});
									return;
								}
								openModelSelect?.();
							},
						},
					});
					return false;
				})
				.with({ isBusy: true }, () => false)
				.with({ hasLoadingAttachments: true }, () => false)
				.otherwise(() => {
					didSend = true;
					if (chatState.hasMessages) {
						chatState.sendMessage({ content: taskContent });
					} else {
						document.startViewTransition(() => chatState.sendMessage({ content: taskContent }));
					}
					return true;
				});

		if (codeAgentState.enabled && codeAgentState.isFreshTab) {
			await codeAgentSendMessageButtonState.handleCodeAgentFlow(() => {
				trySend(content);
			});
			return didSend;
		}
		if (codeAgentState.enabled && codeAgentState.type === "local") {
			// For local mode in non-fresh tabs, only ensure sandbox is running
			const localSandboxResult = await codeAgentSendMessageButtonState.ensureLocalSandboxReady();
			if (!localSandboxResult.isOk) {
				toast.error(localSandboxResult.error ?? m.code_agent_local_sandbox_start_failed());
				return false;
			}
			return trySend(content);
		}
		return trySend(content);
	};

	codeAgentTaskboardState.registerExecutionHandler(runTask);

	async function handleRun() {
		if (codeAgentState.inPlanMode) {
			toast.info(m.toast_exit_plan_mode_first());
			return;
		}

		const allowed = await codeAgentSendMessageButtonState.guardBusyLocalAgents();
		if (!allowed) return;

		await codeAgentTaskboardState.startAutoExecution(runTask);
	}

	const taskContent = $derived(codeAgentTaskboardState.activeTask?.content ?? "—");
</script>

<Item.Root variant="outline" class="w-full max-w-chat-max-w flex-nowrap !cursor-default">
	<Item.Content class="min-w-0 flex flex-row items-center gap-x-2">
		<div class="flex items-center justify-center">
			{#if codeAgentTaskboardState.taskboardStatus === "running" || codeAgentTaskboardState.taskboardStatus === "waiting_to_stop"}
				<LdrsLoader type="ripples" size={32} speed={5} />
			{:else}
				<LdrsLoader type="ping" size={32} speed={5} />
			{/if}
		</div>
		<span class="min-w-0 flex-1 truncate text-sm font-medium">
			{statusText}
			{taskContent}
		</span>
	</Item.Content>
	<Item.Actions>
		<Button variant="secondary" size="sm" onclick={() => agentPreviewState.openTaskboardTab()}>
			{m.title_button_taskboard_panel()}
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class="hover:bg-secondary/80 dark:hover:bg-secondary/80"
			disabled={codeAgentTaskboardState.taskboardStatus !== "running" &&
				codeAgentTaskboardState.taskboardStatus !== "waiting_to_stop" &&
				codeAgentTaskboardState.taskboardStatus !== "waiting_for_chat" &&
				(!codeAgentTaskboardState.canStart || codeAgentState.isChecking || isLocalSandboxStarting)}
			onclick={handleRun}
		>
			{#if codeAgentTaskboardState.taskboardStatus === "running"}
				<Pause class="h-4 w-4" />
			{:else}
				<Play class="h-4 w-4 " />
			{/if}
		</Button>
	</Item.Actions>
</Item.Root>
